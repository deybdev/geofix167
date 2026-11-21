import { useEffect, useState } from 'react';
import { View } from 'react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { loadSampleIncidents } from './sampleIncident';

export default function MapScreen() {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    let mounted = true;

    loadSampleIncidents()
      .then(data => {
        if (mounted) setIncidents(data);
      })
      .catch(error => {
        console.error('Unable to load incidents:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={tw`flex-1`}>
      <MapViewer
        variant="viewer"
        incidents={incidents}
        selectedLocation={null}
        onLocationSelect={() => {}}
        routes={[]}
        trackers={[]}
        dropOffs={[]}
        highlightBoundary
        showBackButton={false}
        hideMapLabel
        compact={false}
      />
    </View>
  );
}