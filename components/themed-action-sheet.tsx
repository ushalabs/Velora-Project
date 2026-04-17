import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

export type ThemedActionSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  reactions?: ThemedActionSheetOption[];
  options: ThemedActionSheetOption[];
  onClose: () => void;
};

export default function ThemedActionSheet({
  visible,
  title,
  message,
  reactions = [],
  options,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 items-center justify-center bg-black/35 px-6" onPress={onClose}>
        <View className="w-full max-w-[360px]">
          <Pressable
            onPress={() => {}}
            className="overflow-hidden rounded-[28px] border border-[#E9D5FF] bg-white"
          >
            <View className="border-b border-[#F3E8FF] bg-[#FAF5FF] px-5 py-4">
              <Text className="text-lg font-bold text-foreground">{title}</Text>
              {message ? (
                <Text className="mt-1 text-sm leading-5 text-muted-foreground">
                  {message}
                </Text>
              ) : null}
            </View>

            <View className="px-3 py-3">
              {reactions.length > 0 ? (
                <View className="mb-3 flex-row items-center justify-between rounded-2xl bg-[#F5F3FF] px-3 py-3">
                  {reactions.map((reaction, index) => (
                    <TouchableOpacity
                      key={`${reaction.label}-${index}`}
                      onPress={() => {
                        onClose();
                        reaction.onPress();
                      }}
                      disabled={reaction.disabled}
                      className={`h-12 w-12 items-center justify-center rounded-full bg-white ${
                        reaction.disabled ? 'opacity-50' : ''
                      }`}
                    >
                      <Text className="text-2xl">{reaction.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {options.map((option, index) => (
                <TouchableOpacity
                  key={`${option.label}-${index}`}
                  onPress={() => {
                    onClose();
                    option.onPress();
                  }}
                  disabled={option.disabled}
                  className={`mb-2 rounded-2xl px-4 py-4 ${
                    option.destructive ? 'bg-red-50' : 'bg-[#F5F3FF]'
                  } ${option.disabled ? 'opacity-50' : ''}`}
                >
                  <Text
                    className={`text-center text-base font-semibold ${
                      option.destructive ? 'text-red-600' : 'text-[#6D28D9]'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={onClose}
                className="rounded-2xl border border-[#E9D5FF] bg-white px-4 py-4"
              >
                <Text className="text-center text-base font-semibold text-foreground">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
