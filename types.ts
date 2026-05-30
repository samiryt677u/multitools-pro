export interface ProjectFile {
  name: string;
  path: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'properties';
  content: string;
  description: string;
}

export interface SimulatorState {
  isOnline: boolean;
  isDarkMode: boolean;
  splashCompleted: boolean;
  activeScreen: 'splash' | 'webview' | 'webpage' | 'offline';
  isLoading: boolean;
  progress: number;
  showNotification: boolean;
  notificationMessage: string;
  showPermissionAlert: boolean;
  selectedFile: string | null;
  cameraActive: boolean;
  capturedImage: string | null;
  history: string[];
  historyIndex: number;
}
