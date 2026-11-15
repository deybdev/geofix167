
import { View, Text, Image } from 'react-native';
import tw from 'twrnc';

import logo from '../../../assets/logo.png';

export default function Logo({
  inverse = false,
  showCard = true,
}) {
  return (
    <View style={tw`flex-col items-center`}>
      {showCard ? (
        <View
          style={[
            tw`h-17 w-17 items-center justify-center rounded-md bg-white`,
            {
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
            },
          ]}
        >
          <Image
            source={logo}
            style={tw`h-15 w-15`}
            resizeMode="contain"
            accessibilityLabel="GeoFix 167 logo"
          />
        </View>
      ) : (
        <Image
          source={logo}
          style={tw`h-15 w-15`}
          resizeMode="contain"
          accessibilityLabel="GeoFix 167 logo"
        />
      )}

      <Text
        style={[
          tw`mt-5 text-3xl font-bold`,
          { letterSpacing: -0.5 },
          { color: inverse ? '#FFFFFF' : '#2E8B57' },
        ]}
      >
        GeoFix 167
      </Text>

      <Text
        style={[
          tw`mt-2 text-lg`,
          { color: inverse ? '#FFFFFF' : '#2E8B57' },
        ]}
      >
        Barangay 167
      </Text>
    </View>
  );
}
