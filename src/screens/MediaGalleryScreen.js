import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '../services/supabaseClient';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container, EmptyState } from '../components/ui';
import Footer from '../components/Footer';


function VideoModalPlayer({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <VideoView
      player={player}
      style={styles.fullMedia}
      nativeControls
      contentFit="contain"
      allowsFullscreen
    />
  );
}

export default function MediaGalleryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('media_gallery').select('*').order('display_order', { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading gallery...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <PageHeader title="Media gallery" subtitle="Photos and short clips from NWSC projects and community events." icon="images-outline" overline="About us" />
      <Container style={styles.content}>

      {items.length === 0 ? (
        <EmptyState icon="images-outline" title="Nothing here yet" message="Photos and clips from NWSC projects and community events will appear here." />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <TouchableOpacity key={item.id} style={styles.tile} onPress={() => setSelected(item)}>
              {item.media_type === 'video' ? (
                <View style={styles.videoTile}>
                  <Ionicons name="play-circle" size={40} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: item.media_url }} style={styles.tileImage} />
              )}
              {item.title ? (
                <View style={styles.tileCaption}>
                  <Text style={styles.tileCaptionText} numberOfLines={1}>{item.title}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={!!selected} animationType="fade" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
            {selected && (
              selected.media_type === 'video' ? (
                <VideoModalPlayer uri={selected.media_url} />
              ) : (
                <Image source={{ uri: selected.media_url }} style={styles.fullMedia} resizeMode="contain" />
              )
            )}
            {selected?.title ? <Text style={styles.modalTitle}>{selected.title}</Text> : null}
            {selected?.description ? <Text style={styles.modalDesc}>{selected.description}</Text> : null}
          </View>
        </View>
      </Modal>
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  sub: { fontSize: 16, color: COLORS.gray500, marginTop: 10, marginBottom: 20 },
  emptyText: { color: COLORS.gray500, fontSize: 14, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  tileImage: { width: '100%', height: '100%' },
  videoTile: { width: '100%', height: '100%', backgroundColor: COLORS.gray800, alignItems: 'center', justifyContent: 'center' },
  tileCaption: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 4, paddingHorizontal: 6 },
  tileCaptionText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', maxWidth: 700, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: -44, right: 0, zIndex: 10 },
  fullMedia: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 8 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 14, alignSelf: 'flex-start' },
  modalDesc: { color: COLORS.gray200, fontSize: 14, marginTop: 4, alignSelf: 'flex-start' },
});
