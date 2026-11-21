import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ResidentLayout from '../layouts/ResidentLayout';
import HomeScreen from '../screens/resident/Home';
import MapScreen from '../screens/resident/Map';
import MyReportsScreen from '../screens/resident/MyReports';
import NotificationsScreen from '../screens/resident/Notifications';
import ProfileScreen from '../screens/resident/Profile';
import ReportScreen from '../screens/resident/Report';
import ReportDetailsScreen from '../screens/resident/ReportDetails';
import TrackScreen from '../screens/resident/Track';

const Stack = createNativeStackNavigator();

function withLayout(Screen) {
  return function WrappedScreen(props) {
    return (
      <ResidentLayout routeName={props.route.name}>
        <Screen {...props} />
      </ResidentLayout>
    );
  };
}

export default function ResidentNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Resident" component={withLayout(HomeScreen)} />
      <Stack.Screen name="Map" component={withLayout(MapScreen)} />
      <Stack.Screen name="MyReports" component={withLayout(MyReportsScreen)} />
      <Stack.Screen name="Notifications" component={withLayout(NotificationsScreen)} />
      <Stack.Screen name="ReportDetails" component={withLayout(ReportDetailsScreen)} />
      <Stack.Screen name="Profile" component={withLayout(ProfileScreen)} />
      <Stack.Screen name="Report" component={withLayout(ReportScreen)} />
      <Stack.Screen name="Track" component={withLayout(TrackScreen)} />
    </Stack.Navigator>
  );
}
