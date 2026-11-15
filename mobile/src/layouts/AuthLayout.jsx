import { View, Image, Text } from 'react-native';
import tw from 'twrnc';

import loginImg from '../../assets/login-img.png';

export default function AuthLayout({ children }) {
  return (
    <View style={tw`flex-1 bg-[#2E8B57]`}>

      {/* Header band */}
      <View style={[tw`relative items-center pt-14 pb-16`, { overflow: 'hidden' }]}>

        {/* Background photo */}
        <Image
          source={loginImg}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '210%', opacity: 0.12 }}
          resizeMode="cover"
        />

        {/* Logo card */}
        <View style={[
          tw`items-center justify-center rounded-2xl bg-white`,
          { width: 76, height: 76, elevation: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16 }
        ]}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 56, height: 56 }}
            resizeMode="contain"
            accessibilityLabel="GeoFix 167 logo"
          />
        </View>

        {/* App name */}
        <Text style={[tw`mt-4 text-3xl font-bold text-white`, { letterSpacing: -0.5 }]}>
          GeoFix 167
        </Text>

        {/* Tagline pill */}
        <View style={[tw`mt-2 rounded-full px-4 py-1`, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <Text style={[tw`text-xs font-semibold text-white`, { letterSpacing: 2 }]}>
            BARANGAY 167
          </Text>
        </View>

        {/* Wave — large rounded View that peeks up from below */}
        <View style={{
          position: 'absolute',
          bottom: -40,
          left: -20,
          right: -20,
          height: 80,
          backgroundColor: '#fff',
          borderTopLeftRadius: 999,
          borderTopRightRadius: 999,
        }} />
      </View>

      {/* White content area */}
      <View style={tw`flex-1 bg-white px-6 pt-2 pb-6`}>
        <View style={tw`w-full max-w-sm self-center flex-1`}>
          {children}
        </View>
      </View>

    </View>
  );
}
