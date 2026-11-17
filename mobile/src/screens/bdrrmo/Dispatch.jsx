import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { createResponderDispatch } from '../../services/responderDispatchService';
import { buildSampleIncidents } from '../../utils/map/sampleIncidents';

const BOUNDARY = require('../../../assets/map/barangay-167.json');
const URGENCY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const RESPONSE_UNITS = [
  { id: 'unit-01', name: 'BDRRMO Unit 01', mobile: '09947833417', vehicle: 'Vehicle 01' },
  { id: 'unit-02', name: 'BDRRMO Unit 02', mobile: '09171258364', vehicle: 'Vehicle 02' },
];

function getDispatchTargets(category) {
  if (category === 'fire') return ['BFP', 'Police'];
  if (category === 'crime') return ['Police'];
  if (category === 'incident') return ['Police', 'BDRRMO'];
  return ['BDRRMO'];
}

function getDispatchTargetRoles(category) {
  return getDispatchTargets(category).map((target) => (
    target === 'BFP' ? 'fire' : target.toLowerCase()
  ));
}

export default function Dispatch() {
  const { user } = useAuth();
  const reports = useMemo(() => buildSampleIncidents(BOUNDARY), []);
  const [selectedReport, setSelectedReport] = useState(null);
  const [urgency, setUrgency] = useState('Medium');
  const [selectedUnit, setSelectedUnit] = useState(RESPONSE_UNITS[0]);
  const [dispatched, setDispatched] = useState({});
  const [dispatchError, setDispatchError] = useState('');

  if (String(user?.role || '').toLowerCase() !== 'bdrrmo') {
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
    setSelectedReport(report);
    setUrgency(report.category === 'fire' ? 'High' : 'Medium');
    setSelectedUnit(RESPONSE_UNITS[0]);
  };

  const confirmDispatch = async () => {
    if (!selectedReport) return;

    try {
      setDispatchError('');
      await createResponderDispatch({
        incident_id: selectedReport.id,
        incident_title: selectedReport.title,
        incident_category: selectedReport.category,
        incident_location: selectedReport.address,
        incident_latitude: selectedReport.lat,
        incident_longitude: selectedReport.lng,
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
      setSelectedReport(null);
    } catch (error) {
      setDispatchError(error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={tw`px-5 pb-6 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Dispatch</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Review urgency and dispatch the correct response teams.
      </Text>
      {dispatchError ? <Text style={tw`mt-2 text-xs text-red-600`}>{dispatchError}</Text> : null}

      <Text style={tw`mt-6 text-lg font-bold text-slate-900`}>Incident queue</Text>
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

      <Modal
        visible={Boolean(selectedReport)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={tw`flex-1 justify-end bg-black/40`}>
          <View style={tw`rounded-t-3xl bg-slate-50 px-5 pb-8 pt-5`}>
            <Text style={tw`text-xl font-extrabold text-slate-900`}>Dispatch incident</Text>
            <Text style={tw`mt-1 text-sm text-slate-500`}>{selectedReport?.title}</Text>
            <Text style={tw`mt-5 text-sm font-bold text-slate-800`}>Urgency</Text>
            <View style={tw`mt-3 flex-row flex-wrap gap-2`}>
              {URGENCY_OPTIONS.map((option) => {
                const isFire = selectedReport?.category === 'fire';
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
            {selectedReport?.category === 'fire' ? (
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
            <View style={tw`mt-5 flex-row gap-3`}>
              <Pressable
                onPress={() => setSelectedReport(null)}
                style={tw`flex-1 items-center rounded-xl bg-white px-4 py-3`}
              >
                <Text style={tw`text-sm font-bold text-slate-600`}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDispatch}
                style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] px-4 py-3`}
              >
                <Text style={tw`text-sm font-bold text-white`}>Confirm dispatch</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
