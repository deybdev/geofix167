import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ResponderLayout, { ResponderNavBar } from '../layouts/ResponderLayout';
import AssignmentsScreen from '../screens/responder/Assignments';
import HistoryScreen from '../screens/responder/History';
import HistoryDetailsScreen from '../screens/responder/HistoryDetails';
import HomeScreen from '../screens/responder/Home';
import IncidentDetailsScreen from '../screens/responder/IncidentDetails';
import IncidentsMapScreen from '../screens/responder/IncidentsMap';
import NavigationScreen from '../screens/responder/Map';
import CallScreen from '../screens/bdrrmo/Call';
import MessagesScreen from '../screens/bdrrmo/Messages';
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
const AssignmentsWithLayout = withLayout(AssignmentsScreen);
const IncidentDetailsWithLayout = withLayout(IncidentDetailsScreen);
const MapWithLayout = withLayout(IncidentsMapScreen);
const NavigationWithLayout = withLayout(NavigationScreen);
const HistoryWithLayout = withLayout(HistoryScreen);
const HistoryDetailsWithLayout = withLayout(HistoryDetailsScreen);
const ProfileWithLayout = withLayout(ProfileScreen);
const MessagesWithLayout = withLayout(MessagesScreen);
const CallWithLayout = withLayout(CallScreen);

export default function ResponderNavigator() {
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
        <Stack.Screen name="Assignments" component={AssignmentsWithLayout} />
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
