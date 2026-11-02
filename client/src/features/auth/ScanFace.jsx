import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleCheck } from "lucide-react";
import { Button } from "../../shared/components/ui/button";

const STEPS = [
  {
    key: "detect",
    label: "Position your face inside the guide",
    success: "Face detected",
  },
  {
    key: "nod",
    label: "Nod your head up and down",
    success: "Nod detected",
  },
  {
    key: "turn",
    label: "Move your head left and right",
    success: "Head movement detected",
  },
];

const MODEL_URL = "/mediapipe/face_landmarker.task";
const WASM_URL = "/mediapipe/wasm";

const HOLD_FRAMES = 6; // frames a pose must be held to count
const TURN_FRAMES = 3; // frames a left/right turn must be held to count
const STABLE_FRAMES = 20; // frames the head must stay still before capture

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

// Face is roughly centered and a good size (values are fractions of the frame)
function isFaceWellPlaced(landmarks) {
  const xs = landmarks.map((p) => p.x);
  const ys = landmarks.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return (
    width > 0.2 &&
    width < 0.75 &&
    Math.abs(centerX - 0.5) < 0.18 &&
    Math.abs(centerY - 0.5) < 0.2
  );
}

function getFaceState(landmarks) {
  const leftEyeCenter = {
    x: (landmarks[33].x + landmarks[133].x) / 2,
    y: (landmarks[33].y + landmarks[133].y) / 2,
  };
  const rightEyeCenter = {
    x: (landmarks[362].x + landmarks[263].x) / 2,
    y: (landmarks[362].y + landmarks[263].y) / 2,
  };
  const eyeCenter = {
    x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
    y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
  };
  const eyeDistance = distance(leftEyeCenter, rightEyeCenter);

  // Left/right head turn: nose position relative to the eyes
  const yaw = (landmarks[1].x - eyeCenter.x) / eyeDistance;

  // Up/down nod: how far the nose sits between the eyes and the chin
  const faceHeight = landmarks[152].y - eyeCenter.y;
  const pitch = (landmarks[1].y - eyeCenter.y) / faceHeight;

  return { yaw, pitch };
}

const ScanFace = () => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [modelLoading, setModelLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [capturedImage, setCapturedImage] = useState("");
  const [faceStatus, setFaceStatus] = useState("idle"); // "idle" | "ok" | "bad"
  const [feedback, setFeedback] = useState("Align your face inside the guide.");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const stepIndexRef = useRef(0);
  const streakRef = useRef(0);
  const basePitchRef = useRef(null);
  const nodMovedRef = useRef(false);
  const leftCountRef = useRef(0);
  const rightCountRef = useRef(0);
  const leftSeenRef = useRef(false);
  const rightSeenRef = useRef(false);
  const capturingRef = useRef(false);
  const stableRef = useRef(0);
  const prevPoseRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const scanCompleteRef = useRef(false);

  function stopCamera() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current?.pause();
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
  }

  // Capture only happens here, after the head has been still and facing forward
  function finishScan() {
    captureFrame();
    stopCamera();
    capturingRef.current = false;
    scanCompleteRef.current = true;
    setIsCapturing(false);
    setCaptureProgress(100);
    setScanComplete(true);
    setFaceStatus("ok");
    setFeedback("Face scan complete. Review your scan.");
  }

  function startCapturePhase() {
    capturingRef.current = true;
    stableRef.current = 0;
    prevPoseRef.current = null;
    setIsCapturing(true);
    setCaptureProgress(0);
    setFeedback("Great! Now face forward and keep your head still.");
  }

  function completeStep() {
    const nextIndex = stepIndexRef.current + 1;
    streakRef.current = 0;
    nodMovedRef.current = false;

    if (nextIndex >= STEPS.length) {
      setStepIndex(nextIndex);
      stepIndexRef.current = nextIndex;
      startCapturePhase();
      return;
    }

    stepIndexRef.current = nextIndex;
    setStepIndex(nextIndex);
    setFeedback(STEPS[nextIndex].label);
  }

  function isStepDetected(step, faceState, placed) {
    if (step === "detect") {
      // Remember the resting head position to measure the nod against
      if (placed) basePitchRef.current = faceState.pitch;
      return placed;
    }

    if (step === "nod") {
      const offset =
        faceState.pitch - (basePitchRef.current ?? faceState.pitch);
      if (Math.abs(offset) > 0.07) nodMovedRef.current = true;
      // Done once the head moved away and came back to the resting position
      return nodMovedRef.current && Math.abs(offset) < 0.03;
    }

    return false;
  }

  // Left and right are one step: both directions must be seen, in any order
  function checkTurnStep(faceState) {
    leftCountRef.current = faceState.yaw > 0.28 ? leftCountRef.current + 1 : 0;
    rightCountRef.current =
      faceState.yaw < -0.28 ? rightCountRef.current + 1 : 0;

    if (leftCountRef.current >= TURN_FRAMES) leftSeenRef.current = true;
    if (rightCountRef.current >= TURN_FRAMES) rightSeenRef.current = true;

    if (leftSeenRef.current && rightSeenRef.current) {
      setFeedback(STEPS[stepIndexRef.current].success);
      completeStep();
      return;
    }

    if (leftSeenRef.current)
      setFeedback("Left detected. Now move your head right.");
    else if (rightSeenRef.current)
      setFeedback("Right detected. Now move your head left.");
    else setFeedback(STEPS[stepIndexRef.current].label);
  }

  // Wait until the head is facing forward AND not moving, then capture
  function checkCapturePhase(landmarks, faceState) {
    const prev = prevPoseRef.current;
    prevPoseRef.current = faceState;

    const basePitch = basePitchRef.current ?? faceState.pitch;
    const facingForward =
      Math.abs(faceState.yaw) < 0.12 &&
      Math.abs(faceState.pitch - basePitch) < 0.06 &&
      isFaceWellPlaced(landmarks);
    const still =
      prev !== null &&
      Math.abs(faceState.yaw - prev.yaw) < 0.02 &&
      Math.abs(faceState.pitch - prev.pitch) < 0.02;

    if (facingForward && still) {
      stableRef.current += 1;
      setFaceStatus("ok");
      setFeedback("Hold still...");
    } else {
      stableRef.current = 0;
      setFaceStatus(facingForward ? "ok" : "bad");
      setFeedback("Face forward and keep your head still.");
    }

    setCaptureProgress(
      Math.min(100, Math.round((stableRef.current / STABLE_FRAMES) * 100)),
    );

    if (stableRef.current >= STABLE_FRAMES) finishScan();
  }

  function scanFrame() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      const result = landmarker.detectForVideo(video, performance.now());
      lastVideoTimeRef.current = video.currentTime;
      const landmarks = result.faceLandmarks?.[0];

      if (!landmarks) {
        streakRef.current = 0;
        stableRef.current = 0;
        prevPoseRef.current = null;
        leftCountRef.current = 0;
        rightCountRef.current = 0;
        if (capturingRef.current) setCaptureProgress(0);
        setFaceStatus("bad");
        setFeedback("No face detected. Center your face in the guide.");
      } else {
        const faceState = getFaceState(landmarks);

        if (capturingRef.current) {
          checkCapturePhase(landmarks, faceState);
        } else {
          const step = STEPS[stepIndexRef.current];
          const placed = isFaceWellPlaced(landmarks);

          // Strict placement only on the first step; afterwards any visible face is OK
          setFaceStatus(step.key === "detect" && !placed ? "bad" : "ok");

          if (step.key === "turn") {
            checkTurnStep(faceState);
          } else {
            const detected = isStepDetected(step.key, faceState, placed);
            streakRef.current = detected ? streakRef.current + 1 : 0;

            if (step.key === "detect" && !placed) {
              setFeedback("Center your face and move closer or farther.");
            } else {
              setFeedback(detected ? "Hold that position..." : step.label);
            }

            if (streakRef.current >= HOLD_FRAMES) {
              setFeedback(step.success);
              completeStep();
            }
          }
        }
      }
    }

    if (!scanCompleteRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }

  useEffect(() => {
    if (!isCameraOpen) return undefined;
    let cancelled = false;

    async function startScan() {
      setModelLoading(true);
      setCameraError("");

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not available in this browser.");
        }

        const [stream, vision] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 720 } },
            audio: false,
          }),
          FilesetResolver.forVisionTasks(WASM_URL),
        ]);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          landmarker.close();
          return;
        }

        streamRef.current = stream;
        landmarkerRef.current = landmarker;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      } catch (error) {
        setCameraError(
          error.message ??
            "Unable to start face scanning. Check your camera permission and try again.",
        );
        stopCamera();
      } finally {
        if (!cancelled) setModelLoading(false);
      }
    }

    startScan();

    return () => {
      cancelled = true;
      stopCamera();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [isCameraOpen]);

  function handleStartScan() {
    stepIndexRef.current = 0;
    streakRef.current = 0;
    basePitchRef.current = null;
    nodMovedRef.current = false;
    leftCountRef.current = 0;
    rightCountRef.current = 0;
    leftSeenRef.current = false;
    rightSeenRef.current = false;
    capturingRef.current = false;
    stableRef.current = 0;
    prevPoseRef.current = null;
    lastVideoTimeRef.current = -1;
    scanCompleteRef.current = false;
    setStepIndex(0);
    setIsCapturing(false);
    setCaptureProgress(0);
    setScanComplete(false);
    setCapturedImage("");
    setFaceStatus("idle");
    setFeedback(STEPS[0].label);
    setCameraError("");
    setIsCameraOpen(true);
  }

  function handleConfirm() {
    setIsCameraOpen(false);
    scanCompleteRef.current = true;
    setFeedback("Face scan confirmed.");
  }

  return (
    <main className="min-h-screen bg-white px-5 py-5 sm:px-8">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        {!isCameraOpen ? (
          <>
            <Camera className="mt-5 text-primary" size={30} />
            <h2 className="mt-3 text-xl font-bold text-primary">
              Verify Your Identity
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-5 text-slate-500">
              Complete the guided face scan to verify that you are physically
              present.
            </p>
            <ul className="mt-4 flex w-full flex-col gap-3 text-left text-sm text-slate-500">
              {[
                "Center your face inside the guide.",
                "Nod your head, then move it left and right.",
                "Face forward and hold still while the photo is taken.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 w-full rounded-md bg-primary/10 px-5 py-3 text-left text-[13px] leading-4 text-primary">
              Allow camera access when prompted. If access is blocked, enable it
              in your device settings.
            </div>
            <Button
              type="button"
              onClick={handleStartScan}
              className="mt-3 h-14 w-full rounded-lg"
            >
              Start Face Scan
            </Button>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-xl font-bold text-primary">Face Scan</h2>
            <p className="mt-2 max-w-xs text-sm leading-5 text-slate-500">
              {modelLoading ? "Preparing face detection..." : feedback}
            </p>
            <div className="mt-3 flex w-full items-center justify-center gap-1">
              {STEPS.map((step, index) => (
                <span
                  key={step.key}
                  className={`h-1.5 flex-1 rounded-full ${
                    index < stepIndex || scanComplete
                      ? "bg-primary"
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <div className="relative mt-3 h-120 w-full overflow-hidden rounded-lg bg-slate-700">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured face scan preview"
                  className="h-full w-full -scale-x-100 object-cover"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
              )}
              {!scanComplete && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={`h-70 w-55 rounded-[50%] border-3 transition-colors duration-200 ${
                      faceStatus === "ok"
                        ? "border-green-500"
                        : faceStatus === "bad"
                          ? "border-red-500"
                          : "border-white"
                    }`}
                  />
                </div>
              )}
              {cameraError && (
                <p className="absolute inset-x-4 bottom-3 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
                  {cameraError}
                </p>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {isCapturing && (
              <div className="mt-3 w-full">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-100"
                    style={{ width: `${captureProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Capturing photo... keep your head still and facing forward.
                </p>
              </div>
            )}

            {scanComplete ? (
              <Button
                type="button"
                onClick={handleConfirm}
                className="mt-4 h-11 w-full rounded-lg"
              >
                <CircleCheck size={18} />
                Confirm
              </Button>
            ) : (
              !isCapturing && (
                <p className="mt-3 text-xs text-slate-500">
                  Follow each instruction to complete the scan.
                </p>
              )
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default ScanFace;
