import { useMemo } from 'react';
import { View } from 'react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { useAuth } from '../../context/AuthContext';
import { buildSampleIncidents } from '../../utils/map/sampleIncidents';

const BOUNDARY = require('../../../assets/map/barangay-167.json');

const ROLE_CATEGORIES = {
  police: ['crime', 'incident', 'fire'],
  fire: ['fire'],
};

export default function ResponderMap() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const incidents = useMemo(() => {
    const categories = ROLE_CATEGORIES[role] || [];

    return buildSampleIncidents(BOUNDARY).filter((incident) =>
      categories.includes(incident.category),
    );
  }, [role]);

  return (
    <View style={tw`flex-1`}>
      <MapViewer
        variant="viewer"
        incidents={incidents}
        showBackButton={false}
        highlightBoundary
        compact={false}
      />
    </View>
  );
}
