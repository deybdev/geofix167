
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import AuthNavigator from '../navigation/AuthNavigator';
import BdrrmoNavigator from '../navigation/BdrrmoNavigator';
import ResidentNavigator from '../navigation/ResidentNavigator';
import ResponderNavigator from '../navigation/ResponderNavigator';
import TanodNavigator from '../navigation/TanodNavigator';
import { useAuth } from '../context/AuthContext';

function AppNavigator() {
  const { user, isRestoring } = useAuth();
  const role = String(user?.role || '').toLowerCase();

  if (isRestoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  if (role === 'resident') return <ResidentNavigator />;
  if (role === 'bdrrmo') return <BdrrmoNavigator />;
  if (role === 'tanod') return <TanodNavigator />;
  if (['responder', 'police', 'fire'].includes(role)) {
    return <ResponderNavigator />;
  }

  return <AuthNavigator />;
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
