import { AuthProvider } from './src/context/AuthContext';

import RootNavigator from './src/app/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

// import { SafeAreaProvider } from 'react-native-safe-area-context';

// import { AuthProvider } from './src/context/AuthContext';
// import MapTestScreen from './src/screens/MapTestScreen';

// export default function App() {
//   return (
//     <SafeAreaProvider>
//       <AuthProvider>
//         <MapTestScreen />
//       </AuthProvider>
//     </SafeAreaProvider>
//   );
// }