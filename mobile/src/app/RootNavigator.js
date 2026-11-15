
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import AuthNavigator from '../navigation/AuthNavigator';
import ResidentNavigator from '../navigation/ResidentNavigator';
import ResponderNavigator from '../navigation/ResponderNavigator';
import { useAuth } from '../context/AuthContext';

function AppNavigator() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  if (user?.role === 'resident') return <ResidentNavigator />;
  if (user?.role === 'responder' || user?.role === 'tanod') {
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
