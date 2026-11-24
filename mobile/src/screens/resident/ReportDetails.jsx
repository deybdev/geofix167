import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { Camera, CheckCircle2, Clock, Image as ImageIcon, Trash2, Wrench } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import tw from 'twrnc';
import { useAuth } from '../../context/AuthContext';
import {
  deleteReportAttachment,
  discardReport,
  getReportDetails,
  updateReportDetails,
  uploadReportAttachment,
} from '../../services/residentService';
import { ReportAction } from '../../components/resident/ReportMedia';
import api from '../../services/api';
import { canEditReport, editPayload, formatReportTime, MAX_ATTACHMENTS } from '../../utils/residentReport';

function resolvePhotoUri(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function ReportDetails({ route }) {
  const publicId = route?.params?.publicId;
  const { user } = useAuth();
  // A different report or account gets entirely new drafts, requests and media.
  return <Details key={`${user?.id}-${publicId}`} publicId={publicId} user={user} />;
}

function Details({ publicId, user }) {
  const navigation = useNavigation();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(Boolean(publicId));
  const [error, setError] = useState(publicId ? '' : 'Report unavailable. Return to My Reports and select a report.');
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [removedPhotoIds, setRemovedPhotoIds] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef(null);
  const saveLock = useRef(false);
  const alive = useRef(true);
  const editable = canEditReport(report);

  usePreventRemove(saving, () => {
    Alert.alert('Please wait', 'Finish the current save operation before leaving this report.');
  });

  const loadReport = useCallback(() => {
    if (!publicId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    return getReportDetails(publicId, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted && alive.current) setReport(data.report);
    }).catch(failure => {
      if (!controller.signal.aborted && alive.current) setError(
        [404, 410].includes(failure.status) ? 'This report is unavailable or no longer exists.'
          : failure.message || 'Could not load this report. Try again.'
      );
    }).finally(() => {
      if (!controller.signal.aborted && alive.current) setLoading(false);
    });
  }, [publicId]);

  function refresh() {
    setLoading(true); setError('');
    return loadReport();
  }

  useEffect(() => {
    alive.current = true;
    loadReport();
    return () => { alive.current = false; request.current?.abort(); };
  }, [loadReport]);

  function startEditing() {
    setDescription(report.description || '');
    setRemovedPhotoIds([]);
    setNewPhotos([]);
    setEditError(''); setNotice(''); setEditing(true);
  }

  async function handlePickPhoto(useCamera) {
    setEditError('');
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setEditError(useCamera
          ? 'Camera permission is required to capture a photo.'
          : 'Photo library permission is required to select a photo.');
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const id = Crypto.randomUUID();
      setNewPhotos((prev) => [
        ...prev,
        {
          id,
          uri: asset.uri,
          name: asset.fileName || `resubmit-${id.slice(0, 8)}.${ext}`,
          type: mimeType,
        },
      ]);
    } catch {
      setEditError('Could not capture or select photo. Please try again.');
    }
  }

  async function save() {
    if (!editable || saveLock.current || loading) return;
    let payload;
    try { payload = editPayload(description, report?.address || ''); } catch (failure) { setEditError(failure.message); return; }
    saveLock.current = true; setSaving(true); setEditError('');
    try {
      for (const mediaId of removedPhotoIds) {
        await deleteReportAttachment(publicId, mediaId);
      }
      for (const photo of newPhotos) {
        await uploadReportAttachment(publicId, photo, photo.id);
      }
      const { data } = await updateReportDetails(publicId, payload);
      if (!alive.current) return;
      setReport(previous => ({ ...previous, ...data.report, attachments: previous.attachments,
        attachments_error: previous.attachments_error, status_events: previous.status_events }));
      setRemovedPhotoIds([]);
      setNewPhotos([]);
      setEditing(false); setNotice(isRejected ? 'Report modified and resubmitted.' : 'Report details saved.');
      await refresh();
    } catch (failure) {
      if (!alive.current) return;
      setEditError([403, 409].includes(failure.status)
        ? 'This report may no longer be editable because its status or access changed. Your draft is retained below.'
        : failure.message || 'Unable to save. Please try again.');
      if ([403, 409].includes(failure.status)) await refresh();
    } finally {
      saveLock.current = false;
      if (alive.current) setSaving(false);
    }
  }

  const isRejected = Number(report?.status_id) === 11 || String(report?.status_label || '').toLowerCase().includes('reject');

  function confirmDiscard() {
    Alert.alert(
      'Discard Draft Report?',
      'This will permanently remove your rejected draft report. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard Report',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await discardReport(publicId);
              if (navigation.canGoBack()) navigation.goBack();
            } catch (err) {
              setEditError(err?.message || 'Unable to discard report.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  const busy = loading || saving;
  const reporterPhotoUrls = (
    Array.isArray(report?.reporter_photo_urls) && report.reporter_photo_urls.length > 0
      ? report.reporter_photo_urls
      : report?.photo_url
        ? [report.photo_url]
        : []
  ).map(resolvePhotoUri).filter(Boolean);
  const responderPhotos = (Array.isArray(report?.responder_photos) ? report.responder_photos : [])
    .map((p) => ({ ...p, uri: resolvePhotoUri(p.url) }))
    .filter((p) => Boolean(p.uri));
  const responderPhotoIds = new Set(responderPhotos.map((p) => p.id).filter(Boolean));
  const editableExistingPhotos = (Array.isArray(report?.attachments) && report.attachments.length > 0
    ? report.attachments
        .filter((a) => a.media_type === 'PHOTO' && !responderPhotoIds.has(a.id))
        .map((a) => ({ id: a.id, uri: resolvePhotoUri(a.url) || a.source?.uri }))
    : reporterPhotoUrls.map((uri) => {
        const match = String(uri).match(/\/photos\/([^/?#]+)/);
        return { id: match ? decodeURIComponent(match[1]) : null, uri };
      })
  ).filter((p) => p.uri && (!p.id || !removedPhotoIds.includes(p.id)));
  const totalEditPhotos = editableExistingPhotos.length + newPhotos.length;

  const rejectionEvent = [...(report?.status_events ?? [])]
    .reverse()
    .find((ev) => Number(ev.to_status_id) === 11 || /^\[(REJECTED|FALSE REPORT)\]/i.test(String(ev.note || '')));
  const rejectionReason = String(rejectionEvent?.note || '')
    .replace(/^\[(REJECTED|FALSE REPORT)\]\s*/i, '')
    .trim();

  return <KeyboardAvoidingView style={tw`flex-1`} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={tw`p-4 pb-12`}
    refreshControl={<RefreshControl refreshing={loading} enabled={!editing && !saving} onRefresh={() => { if (!editing && !busy) refresh(); }} tintColor="#1F7A4D" colors={['#1F7A4D']} />}>
    <Pressable onPress={Keyboard.dismiss}>
    {loading && !report && <View style={tw`items-center py-8`}><ActivityIndicator color="#1F7A4D" /><Text style={tw`mt-3 text-slate-600`}>Loading report...</Text></View>}
    {!!error && <View style={tw`rounded-xl bg-red-50 p-4`}><Text accessibilityRole="alert" style={tw`text-red-800`}>{error}</Text>
      {!!publicId && <ReportAction label="Retry report" onPress={refresh} disabled={busy || editing} />}</View>}
    {report && <>
      <View style={tw`rounded-2xl bg-white p-4`}>
        <Text style={tw`text-xl font-bold text-slate-900`}>{report.title || report.category || 'Incident report'}</Text>
        <View style={tw`mt-3 self-start rounded-xl px-3 py-2 ${isRejected ? 'bg-red-100' : 'bg-green-100'}`}>
          <Text style={tw`font-bold ${isRejected ? 'text-red-800' : 'text-green-900'}`}>{report.status_label || 'Status unavailable'}</Text>
        </View>
        <Field label="Description" value={report.description || 'No description provided.'} />
        <Field label="Location / landmark" value={report.address || 'Location not provided'} />
        {Number.isFinite(report.latitude) && Number.isFinite(report.longitude) && <Field label="Coordinates" value={`${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`} />}
        <Field label="Assigned priority" value={report.urgency} />
        <Field label="Official reference" value={report.reference_number || report.public_id} />
        <Field label="Submitted" value={formatReportTime(report.created_at)} />
      </View>
      {isRejected && !editing && (
        <View style={tw`mt-3 rounded-2xl border border-red-200 bg-red-50 p-4`}>
          <Text style={tw`text-sm font-extrabold text-red-800`}>
            Submitted Report Rejected
          </Text>
          {rejectionReason ? (
            <View style={tw`mt-2 rounded-xl border border-red-200 bg-white px-3 py-2`}>
              <Text style={tw`text-[10px] font-bold uppercase text-red-500`}>Rejection Reason</Text>
              <Text style={tw`mt-0.5 text-xs leading-5 text-slate-800`}>{rejectionReason}</Text>
            </View>
          ) : null}
          <Text style={tw`mt-2 text-xs leading-5 text-red-700`}>
            You can modify the report details to resubmit it for review, or permanently discard this draft.
          </Text>
          <View style={tw`mt-3 flex-row gap-2.5`}>
            <Pressable
              onPress={startEditing}
              disabled={busy}
              style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-2.5`}
            >
              <Text style={tw`text-xs font-bold text-white`}>Modify &amp; Resubmit</Text>
            </Pressable>
            <Pressable
              onPress={confirmDiscard}
              disabled={busy}
              style={tw`flex-1 items-center rounded-xl border border-red-300 bg-white py-2.5`}
            >
              <Text style={tw`text-xs font-bold text-red-700`}>Discard Draft</Text>
            </Pressable>
          </View>
        </View>
      )}
      {!!notice && <Text accessibilityLiveRegion="polite" style={tw`mt-3 rounded-xl bg-green-50 p-3 text-green-800`}>{notice}</Text>}
      {editable && !editing && !isRejected && <ReportAction label="Edit Details" onPress={startEditing} disabled={busy} />}
      {!editable && <Text style={tw`mt-3 text-slate-600`}>Details can only be edited before verification or dispatch. Assigned priority is read-only.</Text>}
      {editing && <View style={tw`mt-4 rounded-2xl border border-slate-200 bg-white p-4`}>
        <Text style={tw`text-base font-extrabold text-slate-900`}>
          {isRejected ? 'Modify & Resubmit Report' : 'Edit Report Details'}
        </Text>
        <Text style={tw`mt-3 text-xs font-bold uppercase text-slate-600`}>Description</Text>
        <TextInput accessibilityLabel="Description" value={description} onChangeText={setDescription} multiline maxLength={10000} editable={!saving && editable} textAlignVertical="top" style={tw`mt-1.5 min-h-28 rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900`} />
        <Text style={tw`mt-4 text-xs font-bold uppercase text-slate-600`}>Pinned Location (Read-Only)</Text>
        <View style={tw`mt-1.5 rounded-xl border border-slate-200 bg-slate-100 p-3`}>
          <Text style={tw`text-sm font-medium text-slate-700`}>
            {report.address || 'Pinned via GPS'}
          </Text>
          <Text style={tw`mt-1 text-[11px] text-slate-500`}>
            Location is locked to the original GPS pin and cannot be manually edited.
          </Text>
        </View>
        <View style={tw`mt-4`}>
          <View style={tw`flex-row items-center justify-between`}>
            <Text style={tw`text-xs font-bold uppercase text-slate-600`}>
              Report Photos ({totalEditPhotos}/{MAX_ATTACHMENTS})
            </Text>
          </View>
          <View style={tw`mt-2 flex-row gap-2`}>
            <Pressable
              onPress={() => handlePickPhoto(true)}
              disabled={saving || totalEditPhotos >= MAX_ATTACHMENTS}
              style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-[#1F7A4D] bg-green-50 py-2.5 ${saving || totalEditPhotos >= MAX_ATTACHMENTS ? 'opacity-40' : ''}`}
            >
              <Camera size={14} color="#1F7A4D" />
              <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>Capture Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => handlePickPhoto(false)}
              disabled={saving || totalEditPhotos >= MAX_ATTACHMENTS}
              style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 ${saving || totalEditPhotos >= MAX_ATTACHMENTS ? 'opacity-40' : ''}`}
            >
              <ImageIcon size={14} color="#334155" />
              <Text style={tw`text-xs font-bold text-slate-700`}>Add from Gallery</Text>
            </Pressable>
          </View>
          {totalEditPhotos > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2.5`}>
              <View style={tw`flex-row gap-2.5`}>
                {editableExistingPhotos.map((photo, idx) => (
                  <View key={photo.id || `existing-${idx}`} style={tw`w-36 overflow-hidden rounded-xl border border-slate-200 bg-slate-50`}>
                    <Image source={{ uri: photo.uri }} style={tw`h-28 w-36 bg-slate-100`} resizeMode="cover" />
                    {photo.id ? (
                      <Pressable
                        onPress={() => setRemovedPhotoIds((prev) => [...prev, photo.id])}
                        disabled={saving}
                        style={tw`flex-row items-center justify-center gap-1 border-t border-red-100 bg-red-50 py-1.5`}
                      >
                        <Trash2 size={12} color="#DC2626" />
                        <Text style={tw`text-[11px] font-bold text-red-700`}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {newPhotos.map((photo) => (
                  <View key={photo.id} style={tw`w-36 overflow-hidden rounded-xl border border-green-300 bg-green-50`}>
                    <Image source={{ uri: photo.uri }} style={tw`h-28 w-36 bg-slate-100`} resizeMode="cover" />
                    <Pressable
                      onPress={() => setNewPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                      disabled={saving}
                      style={tw`flex-row items-center justify-center gap-1 border-t border-red-100 bg-red-50 py-1.5`}
                    >
                      <Trash2 size={12} color="#DC2626" />
                      <Text style={tw`text-[11px] font-bold text-red-700`}>Remove New</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text style={tw`mt-2 text-xs text-slate-500`}>No photos attached. Capture or add a photo above.</Text>
          )}
        </View>
        {!!editError && <Text accessibilityRole="alert" style={tw`mt-3 text-xs font-semibold text-red-700`}>{editError}</Text>}
        <View style={tw`mt-4 flex-row gap-2.5`}>
          <Pressable
            onPress={() => { setEditing(false); setRemovedPhotoIds([]); setNewPhotos([]); setEditError(''); }}
            disabled={saving}
            style={tw`flex-1 items-center rounded-xl border border-slate-300 bg-white py-3`}
          >
            <Text style={tw`text-xs font-bold text-slate-700`}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={busy || !editable}
            style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-3 ${busy || !editable ? 'opacity-50' : ''}`}
          >
            <Text style={tw`text-xs font-bold text-white`}>
              {saving ? 'Saving...' : isRejected ? 'Save & Resubmit' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </View>}
      {reporterPhotoUrls.length > 0 && (
        <View style={tw`mt-5 rounded-2xl border border-slate-200 bg-white p-4`}>
          <Text style={tw`text-xs font-extrabold uppercase text-[#1F7A4D]`}>
            Reporter&apos;s Photo(s) ({reporterPhotoUrls.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2.5`}>
            <View style={tw`flex-row gap-2.5`}>
              {reporterPhotoUrls.map((uri, idx) => (
                <Image
                  key={`rep-photo-${idx}`}
                  source={{ uri }}
                  style={tw`h-36 w-48 rounded-xl bg-slate-100`}
                  resizeMode="cover"
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      {report.report_type !== 'infrastructure' && responderPhotos.length > 0 && (
        <View style={tw`mt-4 rounded-2xl border border-green-200 bg-white p-4`}>
          <Text style={tw`text-xs font-extrabold uppercase text-[#1F7A4D]`}>
            Responder Proof of Completion Photo(s) ({responderPhotos.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2.5`}>
            <View style={tw`flex-row gap-2.5`}>
              {responderPhotos.map((p, idx) => (
                <View key={p.id || `resp-photo-${idx}`} style={tw`w-48 overflow-hidden rounded-xl border border-slate-200 bg-slate-50`}>
                  <Image
                    source={{ uri: p.uri }}
                    style={tw`h-36 w-48 bg-slate-100`}
                    resizeMode="cover"
                  />
                  <Text style={tw`px-2 py-1.5 text-[10px] font-bold text-slate-700`} numberOfLines={1}>
                    {p.label}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      {report.report_type === 'infrastructure' && (
        <MaintenanceProgressSection progress={report.maintenance_progress} reportStatusId={report.status_id} />
      )}
      <Text style={tw`mb-3 mt-6 text-lg font-bold text-slate-900`}>Status history</Text>
      {report.status_events?.length ? <View style={tw`ml-2 border-l-2 border-green-200 pl-4`}>
        {report.status_events.map((event, index) => <View key={event.id ?? index} style={tw`relative mb-3 rounded-xl bg-white p-3`}>
          <View style={[tw`absolute top-4 h-3 w-3 rounded-full bg-green-700`, { left: -23 }]} />
          <Text style={tw`font-bold text-slate-800`}>{event.label || 'Status updated'}</Text>
          <Text style={tw`mt-1 text-xs text-slate-500`}>{formatReportTime(event.created_at)}</Text>
          {!!event.note && <Text style={tw`mt-2 text-slate-700`}>{event.note}</Text>}
        </View>)}
      </View> : <Text style={tw`text-slate-600`}>No status history available yet.</Text>}
    </>}
    </Pressable>
  </ScrollView>
  </KeyboardAvoidingView>;
}

function Field({ label, value }) {
  return <View style={tw`mt-4`}><Text style={tw`text-xs font-bold uppercase text-slate-500`}>{label}</Text><Text selectable style={tw`mt-1 text-base text-slate-800`}>{value || 'Not specified'}</Text></View>;
}

function MaintenanceProgressSection({ progress, reportStatusId }) {
  const isVerifiedFixed = Boolean(progress?.verified_fixed) || Number(reportStatusId) === 10;
  const isAssigned = Boolean(progress?.assigned_tanod) || Number(reportStatusId) >= 6;
  const isInspected = Boolean(progress?.inspection_done) || isVerifiedFixed;
  const isForFunding = Boolean(progress?.for_funding) && !isVerifiedFixed && !progress?.repair_done;
  const isRepaired = Boolean(progress?.repair_done) || isVerifiedFixed;

  const steps = [
    { key: 'submitted', label: 'Report Submitted', done: true, detail: 'Received by Barangay 167 Admin' },
    {
      key: 'assigned',
      label: 'Assigned to Tanod',
      done: isAssigned,
      detail: progress?.assigned_tanod
        ? `Assigned to ${progress.assigned_tanod}`
        : 'Waiting for Admin intake & assignment',
    },
    {
      key: 'inspected',
      label: 'On-Site Inspection Completed',
      done: isInspected,
      detail: progress?.inspection_note
        ? `Tanod note: "${progress.inspection_note}"`
        : isInspected
          ? 'Site inspected & arrival photos uploaded'
          : 'Awaiting on-site inspection by Tanod',
    },
    ...(isForFunding
      ? [
        {
          key: 'for_funding',
          label: 'For Funding',
          done: true,
          detail: progress?.for_funding_note
            ? `Admin note: "${progress.for_funding_note}"`
            : 'Marked For Funding by Admin while materials/budget are arranged',
        },
      ]
      : []),
    {
      key: 'repaired',
      label: 'Proof of Repair Submitted',
      done: isRepaired,
      detail: progress?.repair_note
        ? `Repair note: "${progress.repair_note}"`
        : isRepaired
          ? 'Final repair proof uploaded for Admin verification'
          : isForFunding
            ? 'Pending funding approval & materials'
            : 'Repair work in progress',
    },
    {
      key: 'verified',
      label: 'Verified Fixed',
      done: isVerifiedFixed,
      detail: isVerifiedFixed
        ? 'Verified fixed & closed by Barangay Admin'
        : 'Awaiting final Admin verification',
    },
  ];

  return (
    <View style={tw`mt-6 rounded-2xl border border-green-200 bg-white p-4`}>
      <View style={tw`flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center gap-2`}>
          <Wrench size={18} color="#1F7A4D" />
          <Text style={tw`text-base font-extrabold text-slate-900`}>
            Maintenance Task Progress
          </Text>
        </View>
        <View style={tw`rounded-full bg-green-100 px-2.5 py-1`}>
          <Text style={tw`text-[11px] font-bold text-[#1F7A4D]`}>
            {progress?.stage || (isVerifiedFixed ? 'Verified Fixed' : 'Submitted')}
          </Text>
        </View>
      </View>

      <View style={tw`mt-4 gap-3`}>
        {steps.map((step) => (
          <View key={step.key} style={tw`flex-row items-start gap-2.5`}>
            {step.done ? (
              <CheckCircle2 size={18} color="#1F7A4D" style={tw`mt-0.5`} />
            ) : (
              <Clock size={18} color="#94A3B8" style={tw`mt-0.5`} />
            )}
            <View style={tw`flex-1`}>
              <Text
                style={tw`text-sm font-bold ${
                  step.done ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {step.label}
              </Text>
              <Text style={tw`mt-0.5 text-xs text-slate-600`}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {progress?.inspection_photo_urls?.length > 0 ? (
        <View style={tw`mt-4 border-t border-slate-100 pt-3`}>
          <Text style={tw`text-xs font-extrabold uppercase text-[#1F7A4D]`}>
            Tanod On-Site Inspection Photo(s)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2`}>
            <View style={tw`flex-row gap-2.5`}>
              {progress.inspection_photo_urls.map((uri, idx) => (
                <Image
                  key={`insp-${idx}`}
                  source={{ uri }}
                  style={tw`h-32 w-44 rounded-xl bg-slate-100`}
                  resizeMode="cover"
                />
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {progress?.repair_photo_urls?.length > 0 ? (
        <View style={tw`mt-4 border-t border-slate-100 pt-3`}>
          <Text style={tw`text-xs font-extrabold uppercase text-[#1F7A4D]`}>
            Final Proof of Repair Photo(s)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2`}>
            <View style={tw`flex-row gap-2.5`}>
              {progress.repair_photo_urls.map((uri, idx) => (
                <Image
                  key={`rep-${idx}`}
                  source={{ uri }}
                  style={tw`h-32 w-44 rounded-xl bg-slate-100`}
                  resizeMode="cover"
                />
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
