import React, { useState, useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, EmptyState, Loading } from '../components/ui';
import Footer from '../components/Footer';
import AnnouncementCard from '../components/AnnouncementCard';
import { COLORS, SPACE } from '../theme';
import { fetchAnnouncement } from '../services/announcements';

export default function UpdateDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const [item, setItem] = useState(undefined);

  useEffect(() => {
    fetchAnnouncement(params?.id).then(setItem).catch(() => setItem(null));
  }, [params?.id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader overline="Service update" title={item?.title || 'Service update'} icon="megaphone-outline" />
      <Container narrow style={{ marginTop: -24, gap: SPACE.lg }}>
        {item === undefined ? (
          <Loading />
        ) : item === null || item.status !== 'published' ? (
          <Card>
            <EmptyState
              icon="megaphone-outline"
              title="This update is no longer available"
              message="It may have expired or been withdrawn. See all current service updates."
              action={<Button title="All service updates" onPress={() => navigation.navigate('Updates')} />}
            />
          </Card>
        ) : (
          <View style={{ gap: SPACE.lg }}>
            <AnnouncementCard item={item} full />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button title="All service updates" variant="secondary" icon="list-outline" onPress={() => navigation.navigate('Updates')} />
              <Button title="Get alerts for your area" variant="ghost" icon="notifications-outline" onPress={() => navigation.navigate('Alerts')} />
            </View>
          </View>
        )}
      </Container>
      <Footer />
    </ScrollView>
  );
}
