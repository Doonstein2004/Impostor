import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Captura cualquier error de render descendiente y muestra una pantalla de
 * recuperación. Usar como envoltura alto-nivel en _layout.tsx para que ningún
 * crash deje al usuario en pantalla blanca sin poder volver.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    router.replace('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.message}>
            {this.state.message ?? 'Error inesperado en la pantalla.'}
          </Text>
          <Pressable onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonText}>Volver al inicio</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f0e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a2420',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a3830',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    maxWidth: 360,
    width: '100%',
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    color: '#f1f5f4',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#6b7c78',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  buttonText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 15,
  },
});
