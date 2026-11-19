import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import tw from 'twrnc';
import { useAuth } from '../../context/AuthContext';
import { getReportAttachments, getReportDetails, updateReportDetails } from '../../services/residentService';
import ReportMedia, { ReportAction } from '../../components/resident/ReportMedia';
import { canEditReport, canUploadReport, editPayload, formatReportTime } from '../../utils/residentReport';

export default function ReportDetails({ route }) {
  const publicId = route?.params?.publicId;
  const { user } = useAuth();
  // A different report or account gets entirely new drafts, requests and media.
  return <Details key={`${user?.id}-${publicId}`} publicId={publicId} user={user} />;
}

function Details({ publicId, user }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(Boolean(publicId));
  const [error, setError] = useState(publicId ? '' : 'Report unavailable. Return to My Reports and select a report.');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef(null);
  const mediaRequest = useRef(null);
  const saveLock = useRef(false);
  const alive = useRef(true);
  const editable = canEditReport(report);

  usePreventRemove(saving || uploadBusy, () => {
    Alert.alert('Please wait', 'Finish the current save or media operation before leaving this report.');
  });

  const loadReport = useCallback(() => {
    if (!publicId) return;
    request.current?.abort();
    mediaRequest.current?.abort();
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
    return () => { alive.current = false; request.current?.abort(); mediaRequest.current?.abort(); };
  }, [loadReport]);

  async function reloadMedia() {
    if (mediaRequest.current || loading || saveLock.current || uploadBusy) return;
    const controller = new AbortController();
    mediaRequest.current = controller; setMediaLoading(true);
    try {
      const { data } = await getReportAttachments(publicId, { signal: controller.signal });
      if (!controller.signal.aborted) setReport(previous => ({ ...previous, attachments: data.attachments, attachments_error: null }));
    } catch {
      if (!controller.signal.aborted) setReport(previous => ({ ...previous, attachments_error: 'Photos and videos could not load. Retry media to renew their links.' }));
    } finally {
      if (mediaRequest.current === controller) mediaRequest.current = null;
      if (!controller.signal.aborted && alive.current) setMediaLoading(false);
    }
  }

  function startEditing() {
    setDescription(report.description || ''); setAddress(report.address || '');
    setEditError(''); setNotice(''); setEditing(true);
  }

  async function save() {
    if (!editable || saveLock.current || loading || mediaLoading || uploadBusy) return;
    let payload;
    try { payload = editPayload(description, address); } catch (failure) { setEditError(failure.message); return; }
    saveLock.current = true; setSaving(true); setEditError('');
    try {
      const { data } = await updateReportDetails(publicId, payload);
      if (!alive.current) return;
      setReport(previous => ({ ...previous, ...data.report, attachments: previous.attachments,
        attachments_error: previous.attachments_error, status_events: previous.status_events }));
      setEditing(false); setNotice('Report details saved.');
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

  const busy = loading || mediaLoading || saving || uploadBusy;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tw`p-4 pb-8`}
    refreshControl={<RefreshControl refreshing={loading} enabled={!editing && !saving && !mediaLoading && !uploadBusy} onRefresh={() => { if (!editing && !busy) refresh(); }} tintColor="#1F7A4D" colors={['#1F7A4D']} />}>
    {loading && !report && <View style={tw`items-center py-8`}><ActivityIndicator color="#1F7A4D" /><Text style={tw`mt-3 text-slate-600`}>Loading report...</Text></View>}
    {!!error && <View style={tw`rounded-xl bg-red-50 p-4`}><Text accessibilityRole="alert" style={tw`text-red-800`}>{error}</Text>
      {!!publicId && <ReportAction label="Retry report" onPress={refresh} disabled={busy || editing} />}</View>}
    {report && <>
      <View style={tw`rounded-2xl bg-white p-4`}>
        <Text style={tw`text-xl font-bold text-slate-900`}>{report.title || report.category || 'Incident report'}</Text>
        <View style={tw`mt-3 self-start rounded-xl bg-green-100 px-3 py-2`}><Text style={tw`font-bold text-green-900`}>{report.status_label || 'Status unavailable'}</Text></View>
        <Field label="Description" value={report.description || 'No description provided.'} />
        <Field label="Location / landmark" value={report.address || 'Location not provided'} />
        {Number.isFinite(report.latitude) && Number.isFinite(report.longitude) && <Field label="Coordinates" value={`${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`} />}
        <Field label="Assigned priority" value={report.urgency} />
        <Field label="Official reference" value={report.reference_number || report.public_id} />
        <Field label="Submitted" value={formatReportTime(report.created_at)} />
      </View>
      {!!notice && <Text accessibilityLiveRegion="polite" style={tw`mt-3 rounded-xl bg-green-50 p-3 text-green-800`}>{notice}</Text>}
      {editable && !editing && <ReportAction label="Edit Details" onPress={startEditing} disabled={busy} />}
      {!editable && <Text style={tw`mt-3 text-slate-600`}>Details can only be edited before verification or dispatch. Assigned priority is read-only.</Text>}
      {editing && <View style={tw`mt-4 rounded-2xl bg-white p-4`}>
        <Text style={tw`font-bold text-slate-800`}>Description</Text>
        <TextInput accessibilityLabel="Description" value={description} onChangeText={setDescription} multiline maxLength={10000} editable={!saving && editable} textAlignVertical="top" style={tw`mt-2 min-h-28 rounded-xl border border-slate-300 p-3 text-base text-slate-900`} />
        <Text style={tw`mt-4 font-bold text-slate-800`}>Location / landmark</Text>
        <TextInput accessibilityLabel="Location / landmark" value={address} onChangeText={setAddress} multiline maxLength={4000} editable={!saving && editable} textAlignVertical="top" style={tw`mt-2 min-h-20 rounded-xl border border-slate-300 p-3 text-base text-slate-900`} />
        {!!editError && <Text accessibilityRole="alert" style={tw`mt-3 text-red-700`}>{editError}</Text>}
        <ReportAction label={saving ? 'Saving...' : 'Save Changes'} onPress={save} disabled={busy || !editable} />
        <ReportAction label="Cancel" onPress={() => { setEditing(false); setEditError(''); }} disabled={saving} />
      </View>}
      <ReportMedia reportId={publicId} attachments={report.attachments || []} mediaError={report.attachments_error}
        canUpload={canUploadReport(report, user)} disabled={loading || saving || editing || mediaLoading} onBusy={setUploadBusy} onReload={reloadMedia}
        onResult={(attachments, attachments_error) => setReport(previous => ({ ...previous, attachments, attachments_error }))} />
      {mediaLoading && <ActivityIndicator style={tw`mt-3`} color="#1F7A4D" />}
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
  </ScrollView>;
}

function Field({ label, value }) {
  return <View style={tw`mt-4`}><Text style={tw`text-xs font-bold uppercase text-slate-500`}>{label}</Text><Text selectable style={tw`mt-1 text-base text-slate-800`}>{value || 'Not specified'}</Text></View>;
}
