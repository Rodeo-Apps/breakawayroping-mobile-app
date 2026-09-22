import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from "@/provider/AuthProvider";
import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useTrackScreenFocus } from "@/analytics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  duration: number;
  created_at: string;
  view_count: number;
}

interface UserStories {
  user_id: string;
  name: string;
  avatar_url: string;
  stories: Story[];
}

export default function StoriesViewerScreen() {
  const { profile, user } = useAuth();
  const search = useLocalSearchParams<{ userId?: string; startIndex?: string }>();
  const userId = search.userId as string | undefined;
  const startIndex = Number(search.startIndex ?? 0) || 0;
  useTrackScreenFocus('stories_viewer', { author_user_id: userId ?? '' });

  const leaveViewer = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/(home)");
    }
  }, []);

  const [usersStories, setUsersStories] = useState<UserStories[]>([]);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(startIndex);
  const [loading, setLoading] = useState(true);
  const [viewCounts, setViewCounts] = useState<{ [key: string]: number }>({});

  const progress = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loadStories();
  }, []);

  useEffect(() => {
    if (usersStories.length > 0) {
      markStoryAsViewed();
      startProgress();
    }
    return () => {
      if (progressAnim.current) {
        progressAnim.current.stop();
      }
    };
  }, [currentUserIndex, currentStoryIndex, usersStories]);

  const loadStories = async () => {
    try {
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((stories || []).map((s: any) => s.user_id))];
      let profilesMap: Record<string, { name?: string; avatar_url?: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        profilesMap = (profiles || []).reduce(
          (acc: Record<string, { name?: string; avatar_url?: string }>, p: any) => {
            acc[p.id] = { name: p.name, avatar_url: p.avatar_url };
            return acc;
          },
          {}
        );
      }

      const currentUserDisplayName =
        profile?.name ||
        (profile as any)?.name ||
        (user?.user_metadata?.name as string) || (user?.user_metadata?.full_name as string) ||
        'Unknown';
      const currentUserAvatar = profile?.avatar_url || '';

      const storiesWithProfiles = (stories || []).map((s: any) => {
        const isCurrentUser = profile?.id && s.user_id === profile.id;
        const profileData = isCurrentUser && profile
          ? { name: currentUserDisplayName, avatar_url: currentUserAvatar }
          : profilesMap[s.user_id];
        return {
          ...s,
          profiles: profileData || { name: 'Unknown', avatar_url: '' },
        };
      });

      const groupedStories = new Map<string, UserStories>();

      storiesWithProfiles.forEach((story: any) => {
        if (!groupedStories.has(story.user_id)) {
          groupedStories.set(story.user_id, {
            user_id: story.user_id,
            name: story.profiles?.name || 'Unknown',
            avatar_url: story.profiles?.avatar_url || '',
            stories: [],
          });
        }
        groupedStories.get(story.user_id)!.stories.push(story);
      });

      let usersArray = Array.from(groupedStories.values());
      const userIndex = userId
        ? usersArray.findIndex((u) => u.user_id === userId)
        : 0;
      if (userId && userIndex < 0) {
        usersArray = [];
      }

      setUsersStories(usersArray);
      setCurrentUserIndex(userIndex >= 0 ? userIndex : 0);
      setLoading(false);
    } catch (error) {
      console.error('Error loading stories:', error);
      setLoading(false);
    }
  };

  const markStoryAsViewed = async () => {
    if (!profile?.id || usersStories.length === 0) return;

    const currentUser = usersStories[currentUserIndex];
    if (!currentUser) return;

    const currentStory = currentUser.stories[currentStoryIndex];
    if (!currentStory) return;

    try {
      await supabase.from('story_views').upsert(
        {
          story_id: currentStory.id,
          viewer_id: profile.id,
        },
        { onConflict: 'story_id,viewer_id' }
      );

      const { count } = await supabase
        .from('story_views')
        .select('id', { count: 'exact', head: true })
        .eq('story_id', currentStory.id);

      if (count !== null) {
        setViewCounts(prev => ({ ...prev, [currentStory.id]: count }));
      }
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const startProgress = () => {
    if (progressAnim.current) {
      progressAnim.current.stop();
    }

    progress.setValue(0);

    const currentUser = usersStories[currentUserIndex];
    if (!currentUser) return;

    const currentStory = currentUser.stories[currentStoryIndex];
    if (!currentStory) return;

    const duration = currentStory.duration * 1000;

    progressAnim.current = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });

    progressAnim.current.start(({ finished }) => {
      if (finished) {
        goToNext();
      }
    });
  };

  const goToNext = () => {
    const currentUser = usersStories[currentUserIndex];
    if (!currentUser) return;

    if (currentStoryIndex < currentUser.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else if (currentUserIndex < usersStories.length - 1) {
      setCurrentUserIndex(currentUserIndex + 1);
      setCurrentStoryIndex(0);
    } else {
      leaveViewer();
    }
  };

  const goToPrevious = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else if (currentUserIndex > 0) {
      const prevUser = usersStories[currentUserIndex - 1];
      setCurrentUserIndex(currentUserIndex - 1);
      setCurrentStoryIndex(prevUser.stories.length - 1);
    }
  };

  const handleTap = (x: number) => {
    const halfScreen = SCREEN_WIDTH / 2;
    if (x < halfScreen) {
      goToPrevious();
    } else {
      goToNext();
    }
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 10;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 50) {
        goToPrevious();
      } else if (gestureState.dx < -50) {
        goToNext();
      }
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (usersStories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.emptyText}>No stories available</Text>
        <TouchableOpacity style={styles.closeButton} onPress={leaveViewer}>
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  const currentUser = usersStories[currentUserIndex];
  const currentStory = currentUser?.stories[currentStoryIndex];

  if (!currentUser || !currentStory) {
    return null;
  }

  const isOwnStory = currentUser.user_id === profile?.id;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity
        style={styles.tapArea}
        activeOpacity={1}
        onPress={(e) => handleTap(e.nativeEvent.locationX)}
      >
        <Image source={{ uri: currentStory.media_url }} style={styles.storyImage} />

        <View style={styles.overlay}>
          <View style={styles.header}>
            <View style={styles.progressBars}>
              {currentUser.stories.map((_, index) => (
                <View key={index} style={styles.progressBarContainer}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width:
                          index < currentStoryIndex
                            ? '100%'
                            : index === currentStoryIndex
                            ? progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              })
                            : '0%',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>

            <View style={styles.userInfo}>
              {currentUser.avatar_url ? (
                <Image source={{ uri: currentUser.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
              )}
              <Text style={styles.userName}>{currentUser.name}</Text>
              <Text style={styles.timestamp}>{formatTime(currentStory.created_at)}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={leaveViewer}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {isOwnStory && (
            <View style={styles.viewCountBadge}>
              <Ionicons name="eye" size={16} color="#fff" />
              <Text style={styles.viewCountText}>
                {viewCounts[currentStory.id] || currentStory.view_count || 0}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);

  if (hours < 1) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return date.toLocaleDateString();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapArea: {
    flex: 1,
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  progressBars: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 4,
  },
  progressBarContainer: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    padding: 4,
  },
  viewCountBadge: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
});
