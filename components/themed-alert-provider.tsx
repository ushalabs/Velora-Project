import React, { createContext, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import ThemedActionSheet, { type ThemedActionSheetOption } from '@/components/themed-action-sheet';

type AlertDialogButton = {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
};

type AlertDialogConfig = {
  title: string;
  message?: string;
  buttons: AlertDialogButton[];
};

type ThemedAlertContextValue = {
  showAlert: (title: string, message?: string, onClose?: () => void) => void;
  showConfirm: (options: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => void;
  showActionSheet: (title: string, message: string | undefined, options: ThemedActionSheetOption[]) => void;
};

const ThemedAlertContext = createContext<ThemedAlertContextValue | null>(null);

export function ThemedAlertProvider({ children }: { children: React.ReactNode }) {
  const [dialogConfig, setDialogConfig] = useState<AlertDialogConfig | null>(null);
  const [actionSheetConfig, setActionSheetConfig] = useState<{
    title: string;
    message?: string;
    options: ThemedActionSheetOption[];
  } | null>(null);

  const value = useMemo<ThemedAlertContextValue>(
    () => ({
      showAlert: (title, message, onClose) => {
        setDialogConfig({
          title,
          message,
          buttons: [
            {
              label: 'OK',
              onPress: onClose,
            },
          ],
        });
      },
      showConfirm: ({
        title,
        message,
        confirmLabel = 'Confirm',
        cancelLabel = 'Cancel',
        destructive = false,
        onConfirm,
        onCancel,
      }) => {
        setDialogConfig({
          title,
          message,
          buttons: [
            {
              label: cancelLabel,
              onPress: onCancel,
            },
            {
              label: confirmLabel,
              destructive,
              onPress: onConfirm,
            },
          ],
        });
      },
      showActionSheet: (title, message, options) => {
        setActionSheetConfig({
          title,
          message,
          options,
        });
      },
    }),
    []
  );

  return (
    <ThemedAlertContext.Provider value={value}>
      {children}

      <Modal
        visible={Boolean(dialogConfig)}
        transparent
        animationType="fade"
        onRequestClose={() => setDialogConfig(null)}
      >
        <Pressable className="flex-1 items-center justify-center bg-black/35 px-6" onPress={() => setDialogConfig(null)}>
          <Pressable
            onPress={() => {}}
            className="w-full max-w-[360px] overflow-hidden rounded-[28px] border border-[#E9D5FF] bg-white"
          >
            <View className="bg-[#FAF5FF] px-6 py-5">
              <Text className="text-xl font-bold text-foreground">{dialogConfig?.title}</Text>
              {dialogConfig?.message ? (
                <Text className="mt-2 text-sm leading-6 text-muted-foreground">
                  {dialogConfig.message}
                </Text>
              ) : null}
            </View>

            <View className="flex-row gap-3 px-4 py-4">
              {dialogConfig?.buttons.map((button, index) => (
                <TouchableOpacity
                  key={`${button.label}-${index}`}
                  onPress={() => {
                    const callback = button.onPress;
                    setDialogConfig(null);
                    callback?.();
                  }}
                  className={`flex-1 rounded-2xl px-4 py-4 ${
                    button.destructive ? 'bg-red-50' : index === dialogConfig.buttons.length - 1 ? 'bg-[#8B5CF6]' : 'bg-[#F5F3FF]'
                  }`}
                >
                  <Text
                    className={`text-center text-base font-semibold ${
                      button.destructive
                        ? 'text-red-600'
                        : index === dialogConfig.buttons.length - 1
                          ? 'text-white'
                          : 'text-[#6D28D9]'
                    }`}
                  >
                    {button.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ThemedActionSheet
        visible={Boolean(actionSheetConfig)}
        title={actionSheetConfig?.title || ''}
        message={actionSheetConfig?.message}
        options={actionSheetConfig?.options || []}
        onClose={() => setActionSheetConfig(null)}
      />
    </ThemedAlertContext.Provider>
  );
}

export function useThemedAlert() {
  const context = useContext(ThemedAlertContext);

  if (!context) {
    throw new Error('useThemedAlert must be used within ThemedAlertProvider');
  }

  return context;
}
