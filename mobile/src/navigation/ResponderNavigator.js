import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ResponderLayout from '../layouts/ResponderLayout';
import AssignmentsScreen from '../screens/responder/Assignments';
import HistoryScreen from '../screens/responder/History';
import HomeScreen from '../screens/responder/Home';
import MapScreen from '../screens/responder/Map';
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
const MapWithLayout = withLayout(MapScreen);
const HistoryWithLayout = withLayout(HistoryScreen);
const ProfileWithLayout = withLayout(ProfileScreen);
const MessagesWithLayout = withLayout(MessagesScreen);

export default function ResponderNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeWithLayout} />
      <Stack.Screen name="Assignments" component={AssignmentsWithLayout} />
      <Stack.Screen name="Map" component={MapWithLayout} />
      <Stack.Screen name="Messages" component={MessagesWithLayout} />
      <Stack.Screen name="History" component={HistoryWithLayout} />
      <Stack.Screen name="Profile" component={ProfileWithLayout} />
    </Stack.Navigator>
  );
}
