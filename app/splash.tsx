import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const checkLogin = async () => {
      const logged = await AsyncStorage.getItem("loggedIn");
      if (logged === "true") {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    };
    checkLogin();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
