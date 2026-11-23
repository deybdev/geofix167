import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ResponderLayout, { ResponderNavBar } from '../layouts/ResponderLayout';
import DispatchScreen from '../screens/bdrrmo/Dispatch';
import HomeScreen from '../screens/bdrrmo/Home';
import CallScreen from '../screens/bdrrmo/Call';
import MessagesScreen from '../screens/bdrrmo/Messages';
import HistoryScreen from '../screens/responder/History';
import HistoryDetailsScreen from '../screens/responder/HistoryDetails';
import IncidentDetailsScreen from '../screens/responder/IncidentDetails';
import IncidentsMapScreen from '../screens/responder/IncidentsMap';
import NavigationScreen from '../screens/responder/Map';
import ProfileScreen from '../screens/responder/Profile';

const Stack = createNativeStackNavigator();

function withLayout(Screen) {
  return function WrappedScreen(props) {
    return (
      <ResponderLayout>
        <Screen {...props} />
      </ResponderLayout>
    );
  };
}

const HomeWithLayout = withLayout(HomeScreen);
const DispatchWithLayout = withLayout(DispatchScreen);
const IncidentDetailsWithLayout = withLayout(IncidentDetailsScreen);
const MapWithLayout = withLayout(IncidentsMapScreen);
const NavigationWithLayout = withLayout(NavigationScreen);
const MessagesWithLayout = withLayout(MessagesScreen);
const CallWithLayout = withLayout(CallScreen);
const HistoryWithLayout = withLayout(HistoryScreen);
const HistoryDetailsWithLayout = withLayout(HistoryDetailsScreen);
const ProfileWithLayout = withLayout(ProfileScreen);

export default function BdrrmoNavigator() {
  const navigation = useNavigation();
  const [currentRoute, setCurrentRoute] = useState('Home');

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'none' }}
        screenListeners={{
          state: (e) => {
            const state = e.data?.state;
            const active = state?.routes?.[state.index]?.name;
            if (active) setCurrentRoute(active);
          },
        }}
      >
        <Stack.Screen name="Home" component={HomeWithLayout} />
        <Stack.Screen name="Dispatch" component={DispatchWithLayout} />
        <Stack.Screen name="IncidentDetails" component={IncidentDetailsWithLayout} />
        <Stack.Screen name="Map" component={MapWithLayout} />
        <Stack.Screen name="Navigation" component={NavigationWithLayout} />
        <Stack.Screen name="Messages" component={MessagesWithLayout} />
        <Stack.Screen name="Call" component={CallWithLayout} />
        <Stack.Screen name="History" component={HistoryWithLayout} />
        <Stack.Screen name="HistoryDetails" component={HistoryDetailsWithLayout} />
        <Stack.Screen name="Profile" component={ProfileWithLayout} />
      </Stack.Navigator>
      <ResponderNavBar
        currentRoute={currentRoute}
        onNavigate={(routeName) => navigation.navigate(routeName)}
      />
    </View>
  );
}
