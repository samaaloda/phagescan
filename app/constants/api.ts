import Constants from "expo-constants";
import { Platform } from "react-native";

const PRODUCTION_API_BASE = "https://phagescan-api.onrender.com";

function getDevApiHost(): string {
  const debuggerHost =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;

  if (debuggerHost) {
    return debuggerHost.split(":")[0];
  }

  if (Platform.OS === "android") {
    return "10.0.2.2";
  }

  return "localhost";
}

const API_BASE = __DEV__
  ? `http://${getDevApiHost()}:8000`
  : PRODUCTION_API_BASE;

export const API_BASE_URL = API_BASE;
export const PROCESS_IMAGE_URL = `${API_BASE}/process/`;
