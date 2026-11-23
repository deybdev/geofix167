import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/auth/Login';
import RegisterScreen from '../screens/auth/Register';
import ForgotPasswordScreen from '../screens/auth/ForgotPassword';
import ReportScreen from '../screens/resident/Report';

const Stack = createNativeStackNavigator();

function GuestReportScreen(props) {
  return <ReportScreen {...props} guestMode />;
}

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Guest" component={GuestReportScreen} />
    </Stack.Navigator>
  );
}
