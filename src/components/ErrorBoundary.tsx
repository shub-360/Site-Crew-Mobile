import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center px-6">
          <View className="bg-white border border-slate-200 p-6 rounded-2xl w-full max-w-md items-center shadow-xs">
            <View className="w-12 h-12 rounded-full bg-red-50 items-center justify-center mb-4">
              <Text className="text-xl">⚠️</Text>
            </View>
            <Text className="text-lg font-bold text-slate-800 text-center mb-2">
              Something went wrong
            </Text>
            <Text className="text-sm text-slate-500 text-center mb-6">
              An unexpected application error occurred. You can reload to retry.
            </Text>
            
            {__DEV__ && this.state.error && (
              <ScrollView className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 w-full mb-6">
                <Text className="text-xs font-mono text-red-650">
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.error.stack}
                </Text>
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={this.handleReset}
              className="bg-primary w-full h-11 rounded-xl items-center justify-center active:bg-primary-600"
            >
              <Text className="text-white font-bold text-sm">Reload App</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
