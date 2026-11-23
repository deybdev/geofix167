export const tone = {
  P1: "bg-[#fdecea] text-[#dc2626]",
  P2: "bg-[#fff1c6] text-[#e69500]",
  P3: "bg-[#eef2fb] text-[#4c6fbf]",
  P4: "bg-[#eef2f4] text-[#60738f]",
};

export const statusTone = (code = "") => {
  if (["ACCEPTED", "AVAILABLE", "CLOSED", "COMPLETED"].includes(code)) {
    return "bg-(--gf-green-tint-2) text-(--gf-green)";
  }
  if (
    ["PENDING_ACCEPTANCE", "NEEDS_CORRECTION", "FOR_CLOSURE_REVIEW", "FORWARDED_TO_BDRRMO", "OFFERED", "DISPATCHED"].includes(code)
  ) {
    return "bg-[#fff1c6] text-[#e69500]";
  }
  if (["BUSY", "UNAVAILABLE", "OUT_OF_SERVICE", "DECLINED", "CANCELLED"].includes(code)) {
    return "bg-[#fdecea] text-[#dc2626]";
  }
  return "bg-[#eef2fb] text-[#4c6fbf]";
};

export const priorityTone = (code = "") => {
  if (code === "P1") return "bg-[#fdecea] text-[#dc2626]";
  if (code === "P2") return "bg-[#fff1c6] text-[#e69500]";
  if (code === "P3") return "bg-[#eef2fb] text-[#4c6fbf]";
  return "bg-[#eef2f4] text-[#60738f]";
};
