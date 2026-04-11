import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, ArrowLeft, UserPlus, Check, AlertCircle, X } from 'lucide-react-native';
import { router } from "expo-router";
import { auth } from '@/lib/firebase';
import {
  createFriendRequest,
  findUserByUsername,
  getRelationshipState,
  type FoundUser,
} from '@/lib/firestore';

type SearchState =
  | "idle"
  | "searching"
  | "found"
  | "not-found"
  | "already-friends"
  | "request-sent"
  | "request-received"
  | "yourself";

export default function AddFriendScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);

  const handleSearch = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert('Error', 'You need to sign in again.');
      return;
    }

    if (!searchQuery.trim()) {
      setSearchState("idle");
      setFoundUser(null);
      return;
    }

    setSearchState("searching");

    try {
      const user = await findUserByUsername(searchQuery);

      if (!user) {
        setSearchState("not-found");
        setFoundUser(null);
        return;
      }

      if (user.id === currentUser.uid) {
        setSearchState("yourself");
        setFoundUser(null);
        return;
      }

      const relationship = await getRelationshipState(currentUser.uid, user.id);
      setFoundUser(user);
      if (relationship === 'friends') {
        setSearchState('already-friends');
      } else if (relationship === 'outgoing-request') {
        setSearchState('request-sent');
      } else if (relationship === 'incoming-request') {
        setSearchState('request-received');
      } else {
        setSearchState("found");
      }
    } catch {
      Alert.alert('Error', 'Failed to search for that user.');
      setSearchState("idle");
    }
  };

  const handleAddFriend = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !foundUser) {
      Alert.alert('Error', 'Missing user information. Please try again.');
      return;
    }

    try {
      await createFriendRequest(currentUser, foundUser);
      setSearchState("request-sent");
    } catch {
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  const openChat = () => {
    if (foundUser) {
      router.push({ pathname: '/chat/[id]', params: { id: foundUser.id } });
    }
  };

  const renderAvatar = (user: FoundUser | null) => (
    <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/20">
      {user?.avatar ? (
        <Image source={{ uri: user.avatar }} className="h-full w-full" />
      ) : (
        <Text className="text-2xl font-bold text-primary">
          {user?.username.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );

  const renderSearchResult = () => {
    switch (searchState) {
      case "searching":
        return (
          <View className="flex-1 items-center justify-center pt-20">
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text className="mt-4 text-muted-foreground">Searching...</Text>
          </View>
        );

      case "found":
        return (
          <View className="pt-8">
            <Text className="mb-4 px-6 font-semibold text-foreground">
              User Found
            </Text>
            <View className="mx-6 rounded-2xl border border-border bg-card p-5">
              <View className="flex-row items-center gap-4">
                {renderAvatar(foundUser)}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {foundUser?.username}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleAddFriend}
                className="mt-5 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3"
              >
                <UserPlus size={20} color="#FFFFFF" />
                <Text className="text-base font-semibold text-primary-foreground">
                  Add Friend
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "already-friends":
        return (
          <View className="pt-8">
            <Text className="mb-4 px-6 font-semibold text-foreground">
              Result
            </Text>
            <View className="mx-6 rounded-2xl border border-border bg-card p-5">
              <View className="flex-row items-center gap-4">
                {renderAvatar(foundUser)}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {foundUser?.username}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <Check className="text-green-500" size={16} />
                    <Text className="text-sm text-green-500">
                      Friends
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-4 flex-row items-start gap-3 rounded-lg bg-muted/50 p-3">
                <Check className="mt-0.5 text-primary" size={18} />
                <Text className="flex-1 text-sm text-muted-foreground">
                  You&apos;re already connected with {foundUser?.username}.
                  Start chatting!
                </Text>
              </View>

              <TouchableOpacity
                onPress={openChat}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3"
              >
                <Text className="text-base font-semibold text-secondary-foreground">
                  Open Chat
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "request-sent":
        return (
          <View className="pt-8">
            <Text className="mb-4 px-6 font-semibold text-foreground">
              Request Sent
            </Text>
            <View className="mx-6 rounded-2xl border border-border bg-card p-5">
              <View className="flex-row items-center gap-4">
                {renderAvatar(foundUser)}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {foundUser?.username}
                  </Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    Waiting for them to accept your request
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );

      case "request-received":
        return (
          <View className="pt-8">
            <Text className="mb-4 px-6 font-semibold text-foreground">
              Incoming Request
            </Text>
            <View className="mx-6 rounded-2xl border border-border bg-card p-5">
              <View className="flex-row items-center gap-4">
                {renderAvatar(foundUser)}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {foundUser?.username}
                  </Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    This user already sent you a friend request
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/friends')}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3"
              >
                <Text className="text-base font-semibold text-secondary-foreground">
                  Review Requests
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "yourself":
        return (
          <View className="pt-8">
            <View className="mx-6 rounded-2xl border border-border bg-card p-6">
              <View className="items-center">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <AlertCircle className="text-muted-foreground" size={32} />
                </View>
                <Text className="mb-2 text-lg font-bold text-foreground">
                  Can&apos;t add yourself
                </Text>
                <Text className="text-center text-sm leading-relaxed text-muted-foreground">
                  You can&apos;t add yourself as a friend. Try searching for
                  someone else.
                </Text>
              </View>
            </View>
          </View>
        );

      case "not-found":
        return (
          <View className="pt-8">
            <View className="mx-6 rounded-2xl border border-border bg-card p-6">
              <View className="items-center">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <X className="text-muted-foreground" size={32} />
                </View>
                <Text className="mb-2 text-lg font-bold text-foreground">
                  User not found
                </Text>
                <Text className="text-center text-sm leading-relaxed text-muted-foreground">
                  We couldn&apos;t find a user with username &quot;{searchQuery}
                  &quot;. Check the spelling and try again.
                </Text>
              </View>
            </View>
          </View>
        );

      case "idle":
      default:
        return (
          <View className="flex-1 items-center justify-center px-12 pt-20">
            <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Search className="text-muted-foreground" size={48} />
            </View>
            <Text className="mb-3 text-center text-xl font-bold text-foreground">
              Find Friends
            </Text>
            <Text className="text-center text-base leading-relaxed text-muted-foreground">
              Search for friends by their exact username to connect and start
              chatting.
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
        >
          <ArrowLeft className="text-foreground" size={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Add Friend</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 128 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-6">
          <Text className="mb-3 font-semibold text-foreground">
            Search by username
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 flex-row items-center rounded-xl border border-border bg-input px-4">
              <Search className="mr-3 text-muted-foreground" size={20} />
              <TextInput
                className="flex-1 py-3 text-foreground"
                placeholder="Enter username"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <X className="text-muted-foreground" size={18} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              className="items-center justify-center rounded-xl bg-primary px-5"
              disabled={!searchQuery.trim()}
            >
              <Search size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {renderSearchResult()}
      </ScrollView>
    </SafeAreaView>
  );
}
