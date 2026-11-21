import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  createResponderDispatch,
  getResponderDispatches,
} from '../../services/responderDispatchService';
import { getCategory } from '../../utils/map/mapUtils';

const FORWARDED_TO_BDRRMO_STATUS_ID = '5';
const URGENCY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const RESPONSE_UNITS = [
  { id: 'unit-01', name: 'BDRRMO Unit 01', mobile: '09947833417', vehicle: 'Vehicle 01' },
  { id: 'unit-02', name: 'BDRRMO Unit 02', mobile: '09171258364', vehicle: 'Vehicle 02' },
];

function getDispatchTargets(category) {
  const categoryKey = getCategory(category).key;
  if (categoryKey === 'fire') return ['BFP', 'Police'];
  if (categoryKey === 'crime') return ['Police'];
  if (categoryKey === 'incident') return ['Police', 'BDRRMO'];
  return ['BDRRMO'];
}

function getDispatchTargetRoles(category) {
  return getDispatchTargets(category).map((target) => (
    target === 'BFP' ? 'fire' : target.toLowerCase()
  ));
}

function mapForwardedReport(record) {
  const category = record.category ?? record.incident_category ?? 'Incident / Emergency';
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  const hasCoordinates =
    record.latitude != null &&
    record.longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const address =
    record.location_description ||
    record.landmark_description ||
    (hasCoordinates ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Location unavailable');

  return {
    id: record.incident_id,
    incident_id: record.incident_id,
    title: record.title || `${category} Incident Report`,
    category,
    address,
    lat: hasCoordinates ? lat : undefined,
    lng: hasCoordinates ? lng : undefined,
    status_code: record.status_code,
    is_emergency: Number(record.is_emergency) === 1 ? 1 : 0,
  };
}

export default function Dispatch() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [urgency, setUrgency] = useState('Medium');
  const [selectedUnit, setSelectedUnit] = useState(RESPONSE_UNITS[0]);
  const [dispatched, setDispatched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  const isBdrrmo = String(user?.role || '').toLowerCase() === 'bdrrmo';

  const loadIncidentQueue = useCallback(async (isRefresh = false) => {
    if (!isBdrrmo) return;
    if (isRefresh) setRefreshing(true);
    setLoadError('');

    try {
      const [reportsResponse, persistedDispatches] = await Promise.all([
        api.get('/reports', {
          params: {
            status_id: FORWARDED_TO_BDRRMO_STATUS_ID,
            is_emergency: '1',
          },
        }),
        getResponderDispatches(undefined, 'bdrrmo').catch(() => []),
      ]);

      const rawReports = reportsResponse.data?.reports;
      if (!Array.isArray(rawReports)) {
        throw new Error('The server did not return a valid incident queue.');
      }

      const persistedByIncident = {};
      for (const item of persistedDispatches) {
        if (!item?.incident_id) continue;
        if (!persistedByIncident[item.incident_id]) {
          persistedByIncident[item.incident_id] = {
            urgency: item.urgency || 'High',
            targets: getDispatchTargets(item.incident_category),
            unit: { vehicle: item.vehicle_name || RESPONSE_UNITS[0].vehicle },
          };
        }
      }

      const forwardedReports = rawReports
        .map(mapForwardedReport)
        .filter(
          (item) =>
            item.is_emergency === 1 &&
            item.status_code === 'FORWARDED_TO_BDRRMO' &&
            !persistedByIncident[item.incident_id],
        );

      setDispatched(persistedByIncident);
      setReports(forwardedReports);
    } catch (error) {
      setLoadError(
        error.response?.data?.error ||
          error.message ||
          'Unable to load forwarded emergency reports.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isBdrrmo]);

  useFocusEffect(
    useCallback(() => {
      void loadIncidentQueue(false);
    }, [loadIncidentQueue]),
  );

  if (!isBdrrmo) {
    return (
      <View style={tw`flex-1 items-center justify-center px-6`}>
        <Text style={tw`text-lg font-bold text-slate-900`}>Access restricted</Text>
        <Text style={tw`mt-2 text-center text-sm text-slate-500`}>
          This dispatch workspace is available only to BDRRMO accounts.
        </Text>
      </View>
    );
  }

  const openDispatch = (report) => {
    if (dispatched[report.id] || submitting) return;
    setDispatchError('');
    setSelectedReport(report);
    setUrgency(getCategory(report.category).key === 'fire' ? 'High' : 'Medium');
    setSelectedUnit(RESPONSE_UNITS[0]);
  };

  const confirmDispatch = async () => {
    if (!selectedReport || submitting || dispatched[selectedReport.id]) return;

    setSubmitting(true);
    setDispatchError('');
    try {
      await createResponderDispatch({
        incident_id: selectedReport.incident_id,
        incident_title: selectedReport.title,
        incident_category: selectedReport.category,
        incident_location: selectedReport.address,
        ...(selectedReport.lat != null && selectedReport.lng != null
          ? {
              incident_latitude: selectedReport.lat,
              incident_longitude: selectedReport.lng,
            }
          : {}),
        target_roles: getDispatchTargetRoles(selectedReport.category),
        urgency,
        vehicle_name: selectedUnit.vehicle,
      });
      setDispatched((current) => ({
        ...current,
        [selectedReport.id]: {
          urgency,
          targets: getDispatchTargets(selectedReport.category),
          unit: selectedUnit,
        },
      }));
      setReports((current) => current.filter((item) => item.id !== selectedReport.id));
      setSelectedReport(null);
    } catch (error) {
      setDispatchError(
        error.response?.data?.error ||
          error.message ||
          'The dispatch could not be saved.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={tw`px-5 pb-6 pt-6`}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadIncidentQueue(true)}
          colors={['#1F7A4D']}
          tintColor="#1F7A4D"
        />
      }
    >
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Dispatch</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Review urgency and dispatch the correct response teams.
      </Text>
      {dispatchError ? <Text style={tw`mt-2 text-xs text-red-600`}>{dispatchError}</Text> : null}

      {loadError ? (
        <View style={tw`mt-4 rounded-xl bg-red-50 p-3`}>
          <Text style={tw`text-xs font-semibold text-red-700`}>{loadError}</Text>
          <Pressable
            onPress={() => void loadIncidentQueue(true)}
            style={tw`mt-2 self-start`}
          >
            <Text style={tw`text-xs font-bold text-red-700`}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={tw`mt-6 text-lg font-bold text-slate-900`}>Incident queue</Text>
      {loading ? (
        <View style={tw`mt-6 items-center rounded-2xl bg-white p-6`}>
          <ActivityIndicator size="small" color="#1F7A4D" />
          <Text style={tw`mt-2 text-xs text-slate-500`}>Loading forwarded emergencies...</Text>
        </View>
      ) : !loadError && reports.length === 0 ? (
        <View style={tw`mt-3 rounded-2xl bg-white p-5`}>
          <Text style={tw`text-sm font-bold text-slate-900`}>No forwarded emergencies</Text>
          <Text style={tw`mt-1 text-xs text-slate-500`}>
            Emergency reports verified and forwarded by Admin will appear here.
          </Text>
        </View>
      ) : (
        <View style={tw`mt-3 gap-3`}>
          {reports.map((report) => {
            const dispatch = dispatched[report.id];

            return (
              <View key={report.id} style={tw`rounded-2xl bg-white p-4`}>
                <Text style={tw`text-sm font-bold text-slate-900`}>{report.title}</Text>
                <Text style={tw`mt-1 text-xs text-slate-500`}>
                  {report.category} · {report.address}
                </Text>
                <Text style={tw`mt-2 text-xs font-semibold text-slate-700`}>
                  Teams: {getDispatchTargets(report.category).join(' + ')}
                </Text>
                {dispatch ? (
                  <Text style={tw`mt-2 text-xs font-bold text-[#1F7A4D]`}>
                    Dispatched · {dispatch.urgency} urgency · {dispatch.unit.vehicle}
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => openDispatch(report)}
                    style={tw`mt-3 items-center rounded-xl bg-green-100 px-3 py-2.5`}
                  >
                    <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>Dispatch incident</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={Boolean(selectedReport)}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!submitting) setSelectedReport(null); }}
      >
        <View style={tw`flex-1 justify-end bg-black/40`}>
          <View style={tw`rounded-t-3xl bg-slate-50 px-5 pb-8 pt-5`}>
            <Text style={tw`text-xl font-extrabold text-slate-900`}>Dispatch incident</Text>
            <Text style={tw`mt-1 text-sm text-slate-500`}>{selectedReport?.title}</Text>
            <Text style={tw`mt-5 text-sm font-bold text-slate-800`}>Urgency</Text>
            <View style={tw`mt-3 flex-row flex-wrap gap-2`}>
              {URGENCY_OPTIONS.map((option) => {
                const isFire = getCategory(selectedReport?.category).key === 'fire';
                const selected = urgency === option;
                const disabled = isFire && option !== 'High';

                return (
                  <Pressable
                    key={option}
                    disabled={disabled}
                    onPress={() => setUrgency(option)}
                    style={
                      selected
                        ? tw`rounded-full bg-[#0B2E22] px-4 py-2.5`
                        : disabled
                          ? tw`rounded-full bg-slate-200 px-4 py-2.5 opacity-50`
                          : tw`rounded-full bg-white px-4 py-2.5`
                    }
                  >
                    <Text style={selected ? tw`text-xs font-bold text-white` : tw`text-xs font-semibold text-slate-600`}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {getCategory(selectedReport?.category).key === 'fire' ? (
              <Text style={tw`mt-3 text-xs font-semibold text-red-600`}>
                Fire incidents are automatically set to High urgency.
              </Text>
            ) : null}
            <Text style={tw`mt-4 text-sm text-slate-600`}>
              Dispatch to: {selectedReport ? getDispatchTargets(selectedReport.category).join(' + ') : ''}
            </Text>
            {selectedReport && getDispatchTargets(selectedReport.category).includes('BDRRMO') ? (
              <View style={tw`mt-4`}>
                <Text style={tw`text-sm font-bold text-slate-800`}>BDRRMO unit</Text>
                <View style={tw`mt-2 gap-2`}>
                  {RESPONSE_UNITS.map((unit) => {
                    const selected = selectedUnit.id === unit.id;

                    return (
                      <Pressable
                        key={unit.id}
                        onPress={() => setSelectedUnit(unit)}
                        style={
                          selected
                            ? tw`rounded-xl border-2 border-[#1F7A4D] bg-green-50 p-3`
                            : tw`rounded-xl border border-slate-200 bg-white p-3`
                        }
                      >
                        <Text style={tw`text-xs font-bold text-slate-900`}>{unit.name}</Text>
                        <Text style={tw`mt-1 text-xs text-slate-500`}>
                          Mobile: {unit.mobile} · Vehicle: {unit.vehicle}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            {dispatchError ? <Text style={tw`mt-3 text-xs text-red-600`}>{dispatchError}</Text> : null}
            <View style={tw`mt-5 flex-row gap-3`}>
              <Pressable
                disabled={submitting}
                onPress={() => setSelectedReport(null)}
                style={tw`flex-1 items-center rounded-xl bg-white px-4 py-3 ${submitting ? 'opacity-60' : ''}`}
              >
                <Text style={tw`text-sm font-bold text-slate-600`}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={submitting}
                onPress={confirmDispatch}
                style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] px-4 py-3 ${submitting ? 'opacity-60' : ''}`}
              >
                <Text style={tw`text-sm font-bold text-white`}>
                  {submitting ? 'Dispatching...' : 'Confirm dispatch'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
