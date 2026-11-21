import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ResponderLayout from '../layouts/ResponderLayout';
import DispatchScreen from '../screens/bdrrmo/Dispatch';
import HomeScreen from '../screens/bdrrmo/Home';
import MessagesScreen from '../screens/bdrrmo/Messages';
import HistoryScreen from '../screens/responder/History';
import MapScreen from '../screens/responder/Map';
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
const MapWithLayout = withLayout(MapScreen);
const MessagesWithLayout = withLayout(MessagesScreen);
const HistoryWithLayout = withLayout(HistoryScreen);
const ProfileWithLayout = withLayout(ProfileScreen);

export default function BdrrmoNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeWithLayout} />
      <Stack.Screen name="Dispatch" component={DispatchWithLayout} />
      <Stack.Screen name="Map" component={MapWithLayout} />
      <Stack.Screen name="Messages" component={MessagesWithLayout} />
      <Stack.Screen name="History" component={HistoryWithLayout} />
      <Stack.Screen name="Profile" component={ProfileWithLayout} />
    </Stack.Navigator>
  );
}
