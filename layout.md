# Layout Guide

This document provides instructions for creating layouts and screens in this Expo/NativeWind project.

## Core Principles

1. **Use Flexbox** - React Native uses flexbox for all layouts
2. **Use gap** - Prefer `gap-*` over margins between siblings
3. **Semantic colors** - Use theme colors (`bg-background`, `text-foreground`)
4. **Bottom padding** - Add `pb-32` to ScrollView content for floating tab bar
5. **SafeAreaProvider** - MUST wrap the root layout with SafeAreaProvider
6. **SafeAreaView** - Always wrap screens in SafeAreaView

---

## Screen Structure Template

Every screen should follow this basic structure:

\`\`\`
<CodeProject>
\`\`\`tsx file="app/screen.tsx"
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="p-6">
          <Text className="text-2xl font-bold text-foreground">Screen Title</Text>
        </View>

        {/* Content */}
        <View className="px-6 gap-4">
          {/* Your content here */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Key Points:

- **CRITICAL**: SafeAreaProvider must be in the root layout (`app/_layout.tsx`) - it's required for SafeAreaView to work
- `SafeAreaView` with `flex-1 bg-background` as root
- `ScrollView` with `contentContainerStyle={{ paddingBottom: 128 }}` for tab bar clearance
- Header section with `p-6` padding
- Content section with `px-6` horizontal padding and `gap-4` between items

---


## App Structure

Apps use bottom tab navigation by default. The structure is:

```
app/
├── _layout.tsx          # Root layout (ThemeProvider, SafeAreaProvider, Stack)
├── (tabs)/
│   ├── _layout.tsx      # Tab bar configuration
│   ├── index.tsx        # Home tab
│   ├── search.tsx       # Search tab
│   └── profile.tsx      # Profile tab
└── other-screen.tsx     # Non-tab screens (modals, details, etc.)
```

### Root Layout (`app/_layout.tsx`)

\`\`\`
<CodeProject>
\`\`\`tsx file="app/_layout.tsx"
import { Stack } from "expo-router";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/global.css";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Tab Layout (`app/(tabs)/_layout.tsx`)

**CRITICAL: Tab bar hex colors must match your app's theme.** Convert RGB values from `theme.ts` to hex (e.g., `'251 113 133'` → `'#fb7185'`).

**CRITICAL: NEVER add `height`, `paddingBottom`, or `paddingTop` to `tabBarStyle`.** React Navigation handles safe area insets automatically — adding these values causes the tab bar to overflow and get cropped in the preview.

| Theme Token          | Tab Bar Property          | Purpose            |
|----------------------|---------------------------|--------------------|
| `--background`       | `backgroundColor`         | Tab bar background |
| `--border`           | `borderTopColor`          | Top border         |
| `--primary`          | `tabBarActiveTintColor`   | Active icon/text   |
| `--muted-foreground` | `tabBarInactiveTintColor` | Inactive icon/text |

\`\`\`
<CodeProject>
\`\`\`tsx file="app/(tabs)/_layout.tsx"
import { Tabs } from 'expo-router';
import { Home, Search, User } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';

// Enable className styling for icons
cssInterop(Home, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Search, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // IMPORTANT: Replace hex values with colors from YOUR theme.ts
  // Convert RGB to hex: '251 113 133' → '#fb7185'
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          // Use your theme's background color
          backgroundColor: isDark ? '#1c1917' : '#fffbfa',
          borderTopColor: isDark ? '#44403c' : '#f5ebe9',
        },
        // Use your theme's primary color for active state
        tabBarActiveTintColor: isDark ? '#fb7185' : '#fb7185',
        // Use your theme's muted-foreground for inactive state
        tabBarInactiveTintColor: isDark ? '#a8a29e' : '#78716c',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <Home className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => (
            <Search className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <User className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Tab Screen Example (`app/(tabs)/index.tsx`)

**CRITICAL**: Tab screens must use `edges={['top', 'left', 'right']}` on SafeAreaView. The tab bar already handles the bottom safe area inset — omitting the bottom edge prevents double bottom padding (a ~34px gap between content and the tab bar).

\`\`\`
<CodeProject>
\`\`\`tsx file="app/(tabs)/index.tsx"
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      {/* Header with ThemeToggle */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-2xl font-bold text-foreground">Home</Text>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 128, gap: 16 }}>
        {/* Screen content */}
      </ScrollView>
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

---

## Common Layout Patterns

### 1. Header with Actions

\`\`\`
<CodeProject>
\`\`\`tsx file="components/Header.tsx"
<View className="p-6 flex-row justify-between items-center">
  <View>
    <Text className="text-muted-foreground">Welcome back,</Text>
    <Text className="text-2xl font-bold text-foreground">User Name</Text>
  </View>
  <View className="flex-row items-center gap-4">
    <ThemeToggle />
    <TouchableOpacity>
      <Bell className="text-foreground" size={24} />
    </TouchableOpacity>
  </View>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 2. Section with Title

\`\`\`
<CodeProject>
\`\`\`tsx file="components/Section.tsx"
<View className="mb-6">
  <Text className="text-xl font-bold text-foreground px-6 mb-4">Section Title</Text>
  {/* Section content */}
</View>
\`\`\`
</CodeProject>
\`\`\`

### 3. Horizontal Scrolling List

\`\`\`
<CodeProject>
\`\`\`tsx file="components/HorizontalList.tsx"
<FlatList
  data={items}
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
  renderItem={({ item }) => (
    <Card className="w-64">
      {/* Card content */}
    </Card>
  )}
/>
\`\`\`
</CodeProject>
\`\`\`

### 4. Stats Row (Equal Width Cards)

\`\`\`
<CodeProject>
\`\`\`tsx file="components/StatsRow.tsx"
<View className="px-6">
  <View className="flex-row gap-4">
    <Card className="flex-1">
      <CardContent className="items-center py-4">
        <Icon className="text-primary mb-2" size={24} />
        <Text className="font-bold text-xl">42</Text>
        <Text className="text-sm text-muted-foreground">Label</Text>
      </CardContent>
    </Card>
    {/* More cards with flex-1 */}
  </View>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 5. Menu/Settings List

\`\`\`
<CodeProject>
\`\`\`tsx file="components/MenuList.tsx"
<View className="px-6 gap-2">
  <Text className="text-lg font-semibold text-foreground mb-2">Section</Text>

  <TouchableOpacity>
    <Card>
      <CardContent className="flex-row items-center justify-between py-3">
        <Text>Menu Item</Text>
        <ChevronRight className="text-muted-foreground" size={20} />
      </CardContent>
    </Card>
  </TouchableOpacity>
  {/* More items */}
</View>
\`\`\`
</CodeProject>
\`\`\`

### 6. Profile/Centered Content

\`\`\`
<CodeProject>
\`\`\`tsx file="components/ProfileCard.tsx"
<View className="px-6 mb-6">
  <Card>
    <CardContent className="items-center py-6">
      <Avatar size="2xl" source={{ uri: user.avatar }} />
      <Text className="text-xl font-bold text-foreground mt-4">{user.name}</Text>
      <Text className="text-muted-foreground text-center mt-1">
        {user.bio}
      </Text>
    </CardContent>
  </Card>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 7. Hero Section with Overlay Search

\`\`\`
<CodeProject>
\`\`\`tsx file="components/HeroSearch.tsx"
<View className="px-6 mb-8">
  <HeroImage
    source={{ uri: imageUrl }}
    title="Hero Title"
  />
  {/* Floating search bar */}
  <View className="mt-[-28px] mx-4">
    <Input
      variant="pill"
      placeholder="Search..."
      icon={<Search className="text-primary" size={20} />}
    />
  </View>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 8. Loading State

\`\`\`
<CodeProject>
\`\`\`tsx file="components/LoadingState.tsx"
if (loading) {
  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" />
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### 9. Empty State

\`\`\`
<CodeProject>
\`\`\`tsx file="components/EmptyState.tsx"
<View className="flex-1 items-center justify-center p-6">
  <Icon className="text-muted-foreground mb-4" size={48} />
  <Text className="text-xl font-bold text-foreground text-center">No Items</Text>
  <Text className="text-muted-foreground text-center mt-2">
    You haven't added any items yet.
  </Text>
  <Button className="mt-6">Add First Item</Button>
</View>
\`\`\`
</CodeProject>
\`\`\`

---

## Flexbox Quick Reference

### Direction

| Class              | Direction                                             |
|--------------------|-------------------------------------------------------|
| `flex-row`         | Horizontal (default in web, but RN default is column) |
| `flex-col`         | Vertical (React Native default)                       |
| `flex-row-reverse` | Horizontal reversed                                   |
| `flex-col-reverse` | Vertical reversed                                     |

### Alignment (Main Axis - justify)

| Class             | Alignment     |
|-------------------|---------------|
| `justify-start`   | Start         |
| `justify-center`  | Center        |
| `justify-end`     | End           |
| `justify-between` | Space between |
| `justify-around`  | Space around  |
| `justify-evenly`  | Space evenly  |

### Alignment (Cross Axis - items)

| Class            | Alignment         |
|------------------|-------------------|
| `items-start`    | Start             |
| `items-center`   | Center            |
| `items-end`      | End               |
| `items-stretch`  | Stretch (default) |
| `items-baseline` | Baseline          |

### Flex Sizing

| Class         | Effect               |
|---------------|----------------------|
| `flex-1`      | Grow to fill space   |
| `flex-none`   | Don't grow or shrink |
| `flex-grow`   | Allow growing        |
| `flex-shrink` | Allow shrinking      |
| `basis-[x%]`  | Set base size        |

### Wrapping

| Class         | Effect                |
|---------------|-----------------------|
| `flex-wrap`   | Allow wrapping        |
| `flex-nowrap` | No wrapping (default) |

---

## Spacing Reference

### Padding & Margin Scale

| Size | Value | Common Usage    |
|------|-------|-----------------|
| `1`  | 4px   | Tiny spacing    |
| `2`  | 8px   | Small spacing   |
| `3`  | 12px  | Compact spacing |
| `4`  | 16px  | Default spacing |
| `5`  | 20px  | Medium spacing  |
| `6`  | 24px  | Section padding |
| `8`  | 32px  | Large spacing   |
| `10` | 40px  | Extra large     |
| `12` | 48px  | Huge spacing    |

### Standard Screen Padding
- **Horizontal:** `px-6` (24px)
- **Vertical sections:** `mb-6` or `mb-8`
- **Between items:** `gap-4` (16px)
- **Bottom for tab bar:** `pb-32` (128px)

---

## Responsive Considerations

React Native doesn't have CSS breakpoints. For responsive layouts:

### Use Dimensions API

\`\`\`
<CodeProject>
\`\`\`tsx file="utils/responsive.tsx"
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// Adjust columns based on width
const columns = isTablet ? 3 : 2;
const basisClass = isTablet ? 'basis-[31%]' : 'basis-[48%]';
\`\`\`
</CodeProject>
\`\`\`

### Use useWindowDimensions Hook

\`\`\`
<CodeProject>
\`\`\`tsx file="hooks/useResponsive.tsx"
import { useWindowDimensions } from 'react-native';

function MyComponent() {
  const { width, height } = useWindowDimensions();
  // Respond to dimension changes
}
\`\`\`
</CodeProject>
\`\`\`

---

## Common Mistakes to Avoid

### DON'T: Forget bottom padding for tab bar
\`\`\`tsx
// ❌ Content will be hidden behind tab bar
<ScrollView>
\`\`\`

### DO: Add pb-32 for floating tab bar
\`\`\`tsx
// ✅ Content clears the tab bar
<ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
\`\`\`

### DON'T: Use hardcoded colors
\`\`\`tsx
// ❌ Won't adapt to theme
<View className="bg-white">
<Text className="text-gray-500">
\`\`\`

### DO: Use semantic colors
\`\`\`tsx
// ✅ Adapts to light/dark theme
<View className="bg-background">
<Text className="text-muted-foreground">
\`\`\`

### DON'T: Use margin for spacing between siblings
\`\`\`tsx
// ❌ Margin on each item is repetitive
<View>
  <Card className="mb-4">
  <Card className="mb-4">
  <Card className="mb-4">  // Last one doesn't need margin
\`\`\`

### DO: Use gap on parent
\`\`\`tsx
// ✅ Gap handles spacing cleanly
<View className="gap-4">
  <Card>
  <Card>
  <Card>
\`\`\`

---

## Screen Templates

### List Screen

\`\`\`
<CodeProject>
\`\`\`tsx file="app/list.tsx"
export default function ListScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadItems(); }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FlatList
        data={items}
        contentContainerStyle={{ padding: 24, paddingBottom: 128, gap: 16 }}
        ListHeaderComponent={
          <Text className="text-2xl font-bold text-foreground mb-4">Items</Text>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-muted-foreground">No items found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>{/* Item content */}</Card>
        )}
      />
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Detail Screen

\`\`\`
<CodeProject>
\`\`\`tsx file="app/detail.tsx"
export default function DetailScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Hero/Image */}
        <HeroImage source={{ uri: imageUrl }} height="h-72" />

        {/* Content */}
        <View className="p-6 gap-6">
          <View>
            <Text className="text-3xl font-bold text-foreground">{title}</Text>
            <Text className="text-muted-foreground mt-2">{subtitle}</Text>
          </View>

          <View className="gap-4">
            <Text className="text-xl font-bold text-foreground">Details</Text>
            <Text>{description}</Text>
          </View>
        </View>

        {/* Fixed bottom action */}
        <View className="p-6">
          <Button fullWidth>Take Action</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Form Screen

\`\`\`
<CodeProject>
\`\`\`tsx file="app/form.tsx"
export default function FormScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 128 }}>
        <Text className="text-2xl font-bold text-foreground mb-6">Form Title</Text>

        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium text-foreground mb-2">Field Label</Text>
            <Input placeholder="Enter value..." />
          </View>

          <View>
            <Text className="text-sm font-medium text-foreground mb-2">Another Field</Text>
            <Input placeholder="Enter value..." />
          </View>

          <Button fullWidth className="mt-4">Submit</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`
