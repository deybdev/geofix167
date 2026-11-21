import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ResponderLayout from '../layouts/ResponderLayout';
import MapScreen from '../screens/responder/Map';
import TanodDashboard from '../screens/tanod/TanodDashboard';
import TanodHistory from '../screens/tanod/TanodHistory';
import TanodMap from '../screens/tanod/TanodMap';
import TanodProfile from '../screens/tanod/TanodProfile';
import TanodTasks from '../screens/tanod/TanodTasks';

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

const DashboardWithLayout = withLayout(TanodDashboard);
const TasksWithLayout = withLayout(TanodTasks);
const MapOverviewWithLayout = withLayout(TanodMap);
const MapNavigationWithLayout = withLayout(MapScreen);
const HistoryWithLayout = withLayout(TanodHistory);
const ProfileWithLayout = withLayout(TanodProfile);

export default function TanodNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
      <Stack.Screen name="Home" component={DashboardWithLayout} />
      <Stack.Screen name="Assignments" component={TasksWithLayout} />
      <Stack.Screen name="MapOverview" component={MapOverviewWithLayout} />
      <Stack.Screen name="MapNavigation" component={MapNavigationWithLayout} />
      <Stack.Screen name="History" component={HistoryWithLayout} />
      <Stack.Screen name="Profile" component={ProfileWithLayout} />
    </Stack.Navigator>
  );
}
