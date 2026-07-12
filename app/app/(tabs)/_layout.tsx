import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome5>['name'];
  color: string;
}) {
  return <FontAwesome5 size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() { 
  
  return (
    <Tabs
      initialRouteName="lab-work"
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.secondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.primary,
      }}>
      
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="qrcode-scan" size={24} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="lab-work"
        options={{
          title: 'Lab Work',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="flask" size={24} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="hub"
        options={{
          title: 'Hub',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="database" size={24} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
