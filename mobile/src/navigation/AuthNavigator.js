import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/auth/Login';
import RegisterScreen from '../screens/auth/Register';
import ForgotPasswordScreen from '../screens/auth/ForgotPassword';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}