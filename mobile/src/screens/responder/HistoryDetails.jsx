import { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  FileText,
  Hospital,
  MapPin,
  QrCode,
  Shield,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react-native';
import tw from 'twrnc';

import api from '../../services/api';
import { formatTimestamp, formatTitleCase, getStatusStyle } from '../../utils/dispatchStatus';

const GREEN = '#1F7A4D';

function parseAgencyReportNote(note) {
  if (!note || typeof note !== 'string') return null;
  const cleaned = note.replace(/^\[AGENCY REPORT\]\s*/i, '').trim();
  if (!cleaned) return null;

  const segments = cleaned.split(/\s*\|\s*/);
  const mainPart = segments[0] || '';
  let reportType = 'Responder Resolution Form';
  let summary = mainPart;

  const headerMatch = mainPart.match(/^(.*?by\s+[A-Z]+\s*\(\d+\s*person\(s\)\))\.\s*(.*)$/i);
  if (headerMatch) {
    reportType = headerMatch[1].trim();
    summary = headerMatch[2].trim();
  }

  let persons = [];
  let ltoHandover = null;

  for (const seg of segments.slice(1)) {
    if (seg.startsWith('Involved Persons:')) {
      const rawPersons = seg.replace(/^Involved Persons:\s*/i, '').trim();
      if (rawPersons) {
        persons = rawPersons.split(/\s*,\s*/).map((entry) => {
          const m = entry.match(/^(.*?)(?:\s*\((.*?)\))?(?:\s*\[(.*?)\])?$/);
          return {
            full_name: (m?.[1] || entry).trim(),
            role: (m?.[2] || '').trim(),
            contact: (m?.[3] || '').trim(),
          };
        });
      }
    } else if (seg.startsWith('LTO Handover')) {
      const unitMatch = seg.match(/^LTO Handover\s*\((.*?)\):/i);
      const vehiclesMatch = seg.match(/Vehicles\s*\[(.*?)\]/i);
      const driverMatch = seg.match(/Driver\/License\s*\[(.*?)\]/i);
      const violationMatch = seg.match(/Violation\s*\[(.*?)\]/i);
      ltoHandover = {
        receiving_lto_unit: unitMatch?.[1] || 'LTO Traffic Enforcement',
        vehicles_involved: vehiclesMatch?.[1] || 'N/A',
        driver_license_info: driverMatch?.[1] || 'N/A',
        violation_type: violationMatch?.[1] || 'Road Incident',
      };
    }
  }

  return {
    reportType,
    summary: summary || 'Scene resolved and documented by responding unit.',
    persons,
    ltoHandover,
  };
}

export default function HistoryDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const item = useMemo(() => route.params?.item || {}, [route.params?.item]);

  const [zoomPhotoUri, setZoomPhotoUri] = useState(null);

  const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');
  const isMaintenance = Boolean(item?.is_maintenance);
  const statusStyle = getStatusStyle(item);

  const responderPhotoIds = useMemo(() => {
    const list = [
      ...(Array.isArray(item?.responder_photo_ids) ? item.responder_photo_ids : []),
      ...(Array.isArray(item?.inspection_photo_ids) ? item.inspection_photo_ids : []),
      ...(Array.isArray(item?.repair_photo_ids) ? item.repair_photo_ids : []),
    ];
    return [...new Set(list)];
  }, [item]);

  const reporterPhotoIds = useMemo(
    () => (Array.isArray(item?.reporter_photo_ids) ? item.reporter_photo_ids : []),
    [item],
  );

  const agencyForm = useMemo(
    () => parseAgencyReportNote(item?.agency_report_note),
    [item?.agency_report_note],
  );

  const qrHandover = item?.qr_handover || null;
  const ltoHandover = agencyForm?.ltoHandover || null;

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('History');
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Top Bar */}
      <View style={tw`flex-row items-center justify-between border-b border-slate-200 bg-white px-4 pb-3 pt-3`}>
        <View style={tw`flex-1 flex-row items-center`}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to history"
            hitSlop={8}
            style={({ pressed }) => [
              tw`mr-3 h-9 w-9 items-center justify-center rounded-full bg-slate-100`,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ChevronLeft size={20} color="#0F172A" />
          </Pressable>
          <Text numberOfLines={1} style={tw`flex-1 text-lg font-bold text-slate-900`}>
            Response Record
          </Text>
        </View>

        <View
          style={tw`ml-2 flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${statusStyle.bg}`}
        >
          <View style={[tw`h-1.5 w-1.5 rounded-full`, { backgroundColor: statusStyle.dot }]} />
          <Text style={tw`text-[10px] font-extrabold ${statusStyle.text}`}>
            {statusStyle.label}
          </Text>
        </View>
      </View>

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={tw`gap-3.5 px-4 pb-8 pt-4`}
      >
        {/* 1. Incident Summary & Dispatch Timeline */}
        <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
          <View style={tw`flex-row flex-wrap items-center justify-between gap-1.5`}>
            <View
              style={tw`flex-shrink flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${isMaintenance ? 'bg-green-50' : 'bg-red-50'
                }`}
            >
              {isMaintenance ? (
                <Wrench size={13} color={GREEN} />
              ) : (
                <AlertTriangle size={13} color="#DC2626" />
              )}
              <Text
                numberOfLines={1}
                style={tw`flex-shrink pr-0.5 text-[11px] font-bold ${isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'
                  }`}
              >
                {(isMaintenance
                  ? `Maintenance • ${item?.incident_category || 'Repair'}`
                  : `Emergency • ${item?.incident_category || 'Urgent'}`
                ).toUpperCase()}
              </Text>
            </View>

            <View style={tw`rounded-full bg-slate-100 px-2.5 py-1`}>
              <Text style={tw`pr-0.5 text-[10px] font-bold text-slate-700`}>
                {`${item?.urgency || 'High'} Priority`.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={tw`mt-3 text-lg font-bold leading-6 text-slate-900`}>
            {formatTitleCase(item?.incident_title)}
          </Text>

          {/* Response Timestamps */}
          <View style={tw`mt-3.5 gap-2.5 rounded-xl bg-slate-50 p-3.5`}>
            <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
              Response Timeline
            </Text>

            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Clock size={13} color="#64748B" />
                <Text style={tw`text-xs font-medium text-slate-600`}>Time of Dispatch</Text>
              </View>
              <Text style={tw`text-xs font-bold text-slate-900`}>
                {formatTimestamp(item?.dispatched_at || item?.created_at)}
              </Text>
            </View>

            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center gap-2`}>
                <MapPin size={13} color="#0284C7" />
                <Text style={tw`text-xs font-medium text-slate-600`}>Arrived on Scene</Text>
              </View>
              <Text style={tw`text-xs font-bold text-slate-900`}>
                {item?.arrived_at
                  ? formatTimestamp(item.arrived_at)
                  : item?.dispatched_at
                    ? formatTimestamp(item.dispatched_at)
                    : 'Recorded'}
              </Text>
            </View>

            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center gap-2`}>
                <CheckCircle2 size={13} color={GREEN} />
                <Text style={tw`text-xs font-medium text-slate-600`}>
                  {item?.status === 'COMPLETED' ? 'Time Completed' : 'Latest Update'}
                </Text>
              </View>
              <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>
                {formatTimestamp(
                  item?.completed_at ||
                  qrHandover?.created_at ||
                  item?.updated_at ||
                  item?.dispatched_at,
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Photos Taken by Responder (Proof / Scene Documentation) */}
        <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-1.5`}>
              <Camera size={14} color={GREEN} />
              <Text style={tw`text-xs font-bold uppercase text-slate-700`}>
                Photo(s) Taken by Responder ({responderPhotoIds.length})
              </Text>
            </View>
            {responderPhotoIds.length > 0 ? (
              <Text style={tw`text-[11px] font-semibold text-[#1F7A4D]`}>Tap to enlarge</Text>
            ) : null}
          </View>

          {responderPhotoIds.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={tw`mt-3`}
              contentContainerStyle={tw`gap-3`}
            >
              {responderPhotoIds.map((photoId) => {
                const uri = `${apiBase}/reports/${encodeURIComponent(item.incident_id)}/photos/${encodeURIComponent(photoId)}`;
                return (
                  <Pressable
                    key={photoId}
                    onPress={() => setZoomPhotoUri(uri)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Image
                      source={{ uri }}
                      style={tw`h-48 w-68 rounded-xl bg-slate-200`}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={tw`mt-3 items-center rounded-xl bg-slate-50 py-5`}>
              <Text style={tw`text-xs font-medium text-slate-500`}>
                No scene proof photo uploaded by responder for this record.
              </Text>
            </View>
          )}
        </View>

        {/* 3. Submitted Responder Forms & Field Findings */}
        <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
          <View style={tw`flex-row items-center gap-1.5`}>
            <ClipboardList size={15} color={GREEN} />
            <Text style={tw`text-xs font-bold uppercase text-slate-700`}>
              Submitted Responder Form
            </Text>
          </View>

          {agencyForm ? (
            <View style={tw`mt-3 gap-3`}>
              <View style={tw`rounded-xl bg-green-50 p-3`}>
                <Text style={tw`text-[10px] font-bold uppercase text-[#1F7A4D]`}>
                  Form Type
                </Text>
                <Text style={tw`mt-0.5 text-xs font-bold text-slate-900`}>
                  {agencyForm.reportType}
                </Text>
              </View>

              <View style={tw`rounded-xl bg-slate-50 p-3`}>
                <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                  Scene Findings & Resolution Summary
                </Text>
                <Text style={tw`mt-1 text-xs leading-5 text-slate-800`}>
                  {agencyForm.summary}
                </Text>
              </View>

              {agencyForm.persons.length > 0 ? (
                <View style={tw`gap-2 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Involved Persons Documented ({agencyForm.persons.length})
                  </Text>
                  {agencyForm.persons.map((person, idx) => (
                    <View
                      key={`${person.full_name}-${idx}`}
                      style={tw`flex-row items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2`}
                    >
                      <View style={tw`flex-1 pr-2`}>
                        <Text style={tw`text-xs font-bold text-slate-900`}>
                          {person.full_name}
                        </Text>
                        {person.contact ? (
                          <Text style={tw`text-[11px] text-slate-500`}>{person.contact}</Text>
                        ) : null}
                      </View>
                      {person.role ? (
                        <View style={tw`rounded-full bg-slate-100 px-2.5 py-0.5`}>
                          <Text style={tw`text-[10px] font-bold text-slate-700`}>
                            {person.role}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : qrHandover ? (
            <View style={tw`mt-3 gap-2.5`}>
              <View style={tw`rounded-xl bg-green-50 p-3`}>
                <Text style={tw`text-[10px] font-bold uppercase text-[#1F7A4D]`}>
                  Form Type
                </Text>
                <Text style={tw`mt-0.5 text-xs font-bold text-slate-900`}>
                  Emergency Medical & Hospital Handover Form
                </Text>
              </View>

              {qrHandover.further_info ? (
                <View style={tw`rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Responder Handover Notes
                  </Text>
                  <Text style={tw`mt-1 text-xs leading-5 text-slate-800`}>
                    {String(qrHandover.further_info)}
                  </Text>
                </View>
              ) : null}

              {Array.isArray(qrHandover.patients) && qrHandover.patients.length > 0 ? (
                <View style={tw`gap-2 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Documented Patient(s) ({qrHandover.patients.length})
                  </Text>
                  {qrHandover.patients.map((pt, idx) => (
                    <View
                      key={`${pt.full_name || idx}-${idx}`}
                      style={tw`rounded-lg border border-slate-200 bg-white p-2.5`}
                    >
                      <Text style={tw`text-xs font-bold text-slate-900`}>
                        {pt.full_name || 'Patient'}
                        {pt.age ? ` • ${pt.age} yrs` : ''}
                        {pt.sex ? ` (${pt.sex})` : ''}
                      </Text>
                      {pt.condition ? (
                        <Text style={tw`mt-0.5 text-xs text-slate-700`}>
                          Condition: {pt.condition}
                        </Text>
                      ) : null}
                      {pt.notes ? (
                        <Text style={tw`mt-0.5 text-[11px] text-slate-500`}>
                          Notes: {pt.notes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : isMaintenance && (item?.inspection_note || item?.repair_note) ? (
            <View style={tw`mt-3 gap-2.5`}>
              {item.inspection_note ? (
                <View style={tw`rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Inspection Note
                  </Text>
                  <Text style={tw`mt-1 text-xs text-slate-800`}>{item.inspection_note}</Text>
                </View>
              ) : null}
              {item.repair_note ? (
                <View style={tw`rounded-xl bg-green-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-[#1F7A4D]`}>
                    Repair Completion Note
                  </Text>
                  <Text style={tw`mt-1 text-xs text-slate-800`}>{item.repair_note}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={tw`mt-3 rounded-xl bg-slate-50 p-3.5`}>
              <Text style={tw`text-xs text-slate-600`}>
                {item?.status === 'COMPLETED'
                  ? 'Incident response completed and logged by unit.'
                  : 'Response is currently in progress. Final resolution form will appear once completed.'}
              </Text>
            </View>
          )}
        </View>

        {/* 4. Barcode / QR Handover Takeover Section (Hospital or LTO) */}
        {qrHandover || ltoHandover ? (() => {
          const qrUri = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=16&data=${encodeURIComponent(
            JSON.stringify(
              ltoHandover
                ? {
                  type: 'LTO_ROAD_HANDOVER',
                  incident_id: item?.incident_id,
                  ...ltoHandover,
                }
                : {
                  type: 'HOSPITAL_QR_HANDOVER',
                  handover_id: qrHandover?.handover_id,
                  token: qrHandover?.token,
                  incident_id: item?.incident_id,
                  hospital: qrHandover?.hospital_name,
                },
            ),
          )}`;

          return (
          <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
            <View style={tw`flex-row flex-wrap items-center justify-between gap-2`}>
              <View style={tw`flex-shrink flex-row items-center gap-1.5`}>
                <QrCode size={16} color={ltoHandover ? '#1D4ED8' : GREEN} />
                <Text
                  numberOfLines={1}
                  style={tw`flex-shrink pr-1 text-xs font-bold text-slate-700`}
                >
                  QR Takeover
                </Text>
              </View>
              <View
                style={tw`rounded-full px-2.5 py-1 ${ltoHandover ? 'bg-blue-50' : 'bg-green-50'
                  }`}
              >
                <Text
                  style={tw`pr-0.5 text-[10px] font-bold ${ltoHandover ? 'text-blue-700' : 'text-[#1F7A4D]'
                    }`}
                >
                  VERIFIED HANDOVER
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setZoomPhotoUri(qrUri)}
              accessibilityRole="button"
              accessibilityLabel="Tap to enlarge handover QR barcode"
              style={({ pressed }) => [
                tw`mt-3.5 items-center rounded-2xl bg-slate-50 p-4`,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Image
                source={{ uri: qrUri }}
                style={tw`h-44 w-44 bg-white p-2`}
              />
              <Text style={tw`mt-2.5 text-[11px] font-bold text-slate-500`}>
                Code: {String(qrHandover?.token || item?.incident_id || '').slice(0, 18).toUpperCase()}
              </Text>
              <Text style={tw`mt-1 text-[11px] font-semibold text-[#1F7A4D]`}>
                Tap barcode to enlarge
              </Text>
            </Pressable>

            {ltoHandover ? (
              <View style={tw`mt-3 gap-1.5 rounded-xl bg-blue-50 p-3.5`}>
                <View style={tw`flex-row items-center gap-1.5`}>
                  <Shield size={14} color="#1D4ED8" />
                  <Text style={tw`text-xs font-bold text-blue-950`}>
                    Receiving Unit: {ltoHandover.receiving_lto_unit}
                  </Text>
                </View>
                <Text style={tw`text-xs text-blue-900`}>
                  Vehicles Involved: {ltoHandover.vehicles_involved}
                </Text>
                <Text style={tw`text-xs text-blue-900`}>
                  Driver / License: {ltoHandover.driver_license_info}
                </Text>
                <Text style={tw`text-xs text-blue-900`}>
                  Violation: {ltoHandover.violation_type}
                </Text>
              </View>
            ) : null}

            {qrHandover ? (
              <View style={tw`mt-3 gap-1.5 rounded-xl bg-green-50 p-3.5`}>
                <View style={tw`flex-row items-center gap-1.5`}>
                  <Hospital size={14} color={GREEN} />
                  <Text style={tw`text-xs font-bold text-slate-900`}>
                    Receiving Facility: {qrHandover.hospital_name || 'Partner Hospital'}
                  </Text>
                </View>
                <Text style={tw`text-xs text-slate-700`}>
                  Handover ID: {qrHandover.handover_id}
                </Text>
                {qrHandover.created_at ? (
                  <Text style={tw`text-xs text-slate-600`}>
                    Generated: {formatTimestamp(qrHandover.created_at)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          );
        })() : null}

        {/* 5. Reporter's Initial Photo(s) & Incident Details */}
        <View style={tw`gap-3 rounded-2xl border border-slate-200 bg-white p-4`}>
          <Text style={tw`text-xs font-bold uppercase text-slate-500`}>
            Original Reporter Submission
          </Text>

          {reporterPhotoIds.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={tw`gap-2.5`}
            >
              {reporterPhotoIds.map((photoId) => {
                const uri = `${apiBase}/reports/${encodeURIComponent(item.incident_id)}/photos/${encodeURIComponent(photoId)}`;
                return (
                  <Pressable
                    key={photoId}
                    onPress={() => setZoomPhotoUri(uri)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Image
                      source={{ uri }}
                      style={tw`h-36 w-52 rounded-xl bg-slate-200`}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={tw`flex-row items-start gap-2.5`}>
            <User size={14} color="#475569" style={tw`mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>Reporter</Text>
              <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                {item?.reporter_name || 'Resident Reporter'}
                {item?.reporter_phone ? ` • ${item.reporter_phone}` : ''}
              </Text>
            </View>
          </View>

          <View style={tw`flex-row items-start gap-2.5`}>
            <MapPin size={14} color="#475569" style={tw`mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>Location</Text>
              <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                {item?.incident_location || 'Barangay 167'}
              </Text>
            </View>
          </View>

          {item?.vehicle_name ? (
            <View style={tw`flex-row items-start gap-2.5`}>
              <Truck size={14} color="#475569" style={tw`mt-0.5`} />
              <View style={tw`flex-1`}>
                <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                  Responding Unit
                </Text>
                <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                  {item.vehicle_name}
                </Text>
              </View>
            </View>
          ) : null}

          {item?.incident_description ? (
            <View style={tw`flex-row items-start gap-2.5 border-t border-slate-100 pt-2.5`}>
              <FileText size={14} color="#475569" style={tw`mt-0.5`} />
              <View style={tw`flex-1`}>
                <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                  Incident Description
                </Text>
                <Text style={tw`mt-0.5 text-xs leading-5 text-slate-700`}>
                  {item.incident_description}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Full-Screen Photo Zoom Modal */}
      <Modal
        visible={Boolean(zoomPhotoUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomPhotoUri(null)}
      >
        <View style={tw`flex-1 justify-center bg-black/90 px-4`}>
          <Pressable
            onPress={() => setZoomPhotoUri(null)}
            style={tw`absolute right-5 top-12 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/20`}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
          {zoomPhotoUri ? (
            <Image
              source={{ uri: zoomPhotoUri }}
              style={tw`h-[78%] w-full`}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
