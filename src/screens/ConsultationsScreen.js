import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { showAlert } from '../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container, EmptyState, useBreakpoint } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import Footer from '../components/Footer';
import Outcomes from '../components/Outcomes';
import { useGuestIdentity, communityAction } from '../services/community';


const REACTIONS = [
  { type: 'like', emoji: '👍', color: '#3B82F6' },
  { type: 'love', emoji: '❤️', color: '#EF4444' },
  { type: 'laugh', emoji: '😂', color: '#F59E0B' },
  { type: 'sad', emoji: '😢', color: '#8B5CF6' },
  { type: 'angry', emoji: '😡', color: '#DC2626' },
];

export default function ConsultationsScreen() {
  const { isDesktop } = useBreakpoint();
  const navigation = useNavigation();
  const [consultations, setConsultations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [activeConsultation, setActiveConsultation] = useState(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentLikeLoading, setCommentLikeLoading] = useState({});

  // ----- Helper: create notification -----
  const createNotification = async (_userId, title, message, type, targetScreen, targetId = null) => {
    await supabase.rpc('notify_admins', {
      p_title: title, p_message: message, p_type: type, p_screen: targetScreen, p_target: targetId,
    });
  };

  // Admin notifications go through notify_admins() (users are private now).
  const getAdminUser = async () => ({ id: 'admins' });

  // ----- Fetch data -----
  useEffect(() => {
    fetchData();
  }, [selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: catData } = await supabase.from('categories').select('*');
      if (catData) setCategories(catData);

      let query = supabase
        .from('consultations')
        .select(`
          *,
          polls: polls (
            id, question, poll_options (id, option_text, vote_count)
          ),
          likes (reaction_type, user_id),
          comments (
            id, text, image_url, user_id, created_at, author_name,
            comment_likes (user_id)
          )
        `)
        .eq('is_active', true)
        .order('engagement_score', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.ilike('title', `%${selectedCategory}%`);
      }

      const { data: consData } = await query;
      if (consData) {
        const userLikes = {};
        if (user) {
          const { data: likesData } = await supabase
            .from('likes')
            .select('consultation_id, reaction_type')
            .eq('user_id', user.id);
          likesData.forEach(l => { userLikes[l.consultation_id] = l.reaction_type; });
        }

        const enriched = consData.map(c => {
          const commentsWithLikes = c.comments ? c.comments.map(comment => ({
            ...comment,
            likeCount: comment.comment_likes ? comment.comment_likes.length : 0,
            userLiked: comment.comment_likes ? comment.comment_likes.some(cl => cl.user_id === user?.id) : false,
          })) : [];
          return {
            ...c,
            likeCount: c.likes ? c.likes.length : 0,
            commentCount: commentsWithLikes.length,
            pollVoteCount: c.polls ? c.polls.reduce((sum, p) => sum + (p.poll_options ? p.poll_options.reduce((s, o) => s + o.vote_count, 0) : 0), 0) : 0,
            engagementScore: (c.likes ? c.likes.length : 0) + commentsWithLikes.length + (c.polls ? c.polls.reduce((sum, p) => sum + (p.poll_options ? p.poll_options.reduce((s, o) => s + o.vote_count, 0) : 0), 0) : 0),
            userReaction: userLikes[c.id] || null,
            comments: commentsWithLikes,
          };
        });
        setConsultations(enriched);
      }


    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ----- Like / React on post -----
  const handleReact = async (consultationId, reactionType) => {
    if (!user) {
      showAlert('View only', 'You can read this consultation here. Reactions are for NWSC staff.');
      return;
    }
    const { data: existing } = await supabase
      .from('likes')
      .select('*')
      .eq('user_id', user.id)
      .eq('consultation_id', consultationId)
      .maybeSingle();
    if (existing) {
      if (existing.reaction_type !== reactionType) {
        await supabase.from('likes').update({ reaction_type: reactionType }).eq('id', existing.id);
      } else {
        await supabase.from('likes').delete().eq('id', existing.id);
      }
    } else {
      await supabase.from('likes').insert([{ user_id: user.id, consultation_id: consultationId, reaction_type: reactionType }]);
    }
    fetchData();
  };

  // ----- Comment -----
  const guest = useGuestIdentity();
  const openCommentModal = (consultation) => {
    setActiveConsultation(consultation);
    setCommentText('');
    setCommentImage(null);
    setCommentModalVisible(true);
  };

  // ----- Updated Image Picker (new API) -----
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Please grant camera roll permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // ✅ new API
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      setCommentImage(result.assets[0]);
    }
  };

  const submitComment = async () => {
    if (!user) {
      // Citizens comment with a name + phone (text only).
      if (!commentText.trim()) {
        showAlert('Comment needed', 'Please write your comment.');
        return;
      }
      guest.run(async (id) => {
        try {
          await communityAction({ action: 'comment', ...id, consultation_id: activeConsultation.id, text: commentText.trim() });
          await createNotification(null, 'New Comment', `Comment on: ${activeConsultation.title}`, 'info', 'Consultations', activeConsultation.id);
          setCommentModalVisible(false);
          showAlert('Thank you!', 'Your comment has been posted.');
          fetchData();
        } catch (e) {
          showAlert('Could not post', e.message);
        }
      });
      return;
    }
    if (!commentText.trim() && !commentImage) {
      showAlert('Error', 'Please enter text or select an image.');
      return;
    }
    try {
      let imageUrl = null;
      if (commentImage) {
        const blob = await fetch(commentImage.uri).then(r => r.blob());
        const fileName = `${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from('comment_images')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
          });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('comment_images').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }
      await supabase.from('comments').insert([{
        user_id: user.id,
        consultation_id: activeConsultation.id,
        text: commentText.trim(),
        image_url: imageUrl,
      }]);
      const admin = await getAdminUser();
      if (admin) {
        await createNotification(admin.id, 'New Comment', `Comment on: ${activeConsultation.title}`, 'info', 'Consultations', activeConsultation.id);
      }
      setCommentModalVisible(false);
      showAlert('Thank You!', 'Your comment has been posted.');
      fetchData();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  // ----- Poll Vote -----
  const handlePollVote = async (pollOptionId, consultationId) => {
    if (!user) {
      guest.run(async (id) => {
        try {
          await communityAction({ action: 'poll_vote', ...id, poll_option_id: pollOptionId });
          showAlert('Vote recorded', 'Thank you for voting!');
          fetchData();
        } catch (e) {
          showAlert('Vote not recorded', e.message);
        }
      });
      return;
    }
    const { data: existing } = await supabase
      .from('poll_votes')
      .select('*')
      .eq('user_id', user.id)
      .eq('consultation_id', consultationId)
      .maybeSingle();
    if (existing) {
      await supabase.from('poll_votes').delete().eq('id', existing.id);
      showAlert('Vote Removed', 'Your poll vote has been removed.');
    } else {
      await supabase.from('poll_votes').insert([{
        user_id: user.id,
        poll_option_id: pollOptionId,
        consultation_id: consultationId,
      }]);
      showAlert('Vote Recorded', 'Thank you for voting!');
    }
    fetchData();
  };

  // ----- Like a comment -----
  const handleCommentLike = async (commentId, consultationId) => {
    if (!user) {
      showAlert('View only', 'You can read comments here. Liking one is for NWSC staff.');
      return;
    }
    setCommentLikeLoading(prev => ({ ...prev, [commentId]: true }));
    try {
      const { data: existing } = await supabase
        .from('comment_likes')
        .select('*')
        .eq('user_id', user.id)
        .eq('comment_id', commentId)
        .maybeSingle();
      if (existing) {
        await supabase.from('comment_likes').delete().eq('id', existing.id);
      } else {
        await supabase.from('comment_likes').insert([{ user_id: user.id, comment_id: commentId }]);
      }
      fetchData();
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setCommentLikeLoading(prev => ({ ...prev, [commentId]: false }));
    }
  };

  // ----- Render consultation item (with image) -----
  const renderConsultation = ({ item }) => (
    <View style={styles.consultCard}>
      <View style={styles.consultHeader}>
        <View style={styles.badgeOpen}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeOpenText}>Open</Text>
        </View>
        <Text style={styles.badgeClosing}>Closes: {new Date(item.closing_date).toDateString()}</Text>
      </View>
      <Text style={styles.consultTitle}>{item.title}</Text>
      <Text style={styles.consultDesc}>{item.description}</Text>

      {/* ✅ Display consultation image if exists */}
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.consultImage} />
      )}

      <View style={styles.engagementRow}>
        <TouchableOpacity style={styles.engItem} onPress={() => handleReact(item.id, 'like')}>
          <Ionicons name={item.userReaction ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={COLORS.primary} />
          <Text style={styles.engText}>{item.likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.engItem} onPress={() => openCommentModal(item)}>
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
          <Text style={styles.engText}>{item.commentCount}</Text>
        </TouchableOpacity>
        <View style={styles.engItem}>
          <Ionicons name="bar-chart-outline" size={18} color={COLORS.primary} />
          <Text style={styles.engText}>{item.pollVoteCount} votes</Text>
        </View>
        <View style={styles.engItem}>
          <Ionicons name="trophy-outline" size={18} color={COLORS.accent} />
          <Text style={styles.engText}>Score: {item.engagementScore}</Text>
        </View>
      </View>

      <View style={styles.reactionBar}>
        {REACTIONS.map((r) => (
          <TouchableOpacity
            key={r.type}
            style={[styles.reactionBtn, item.userReaction === r.type && styles.reactionActive]}
            onPress={() => handleReact(item.id, r.type)}
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {item.polls && item.polls.length > 0 && (
        <View style={styles.pollSection}>
          <Text style={styles.pollQuestion}>{item.polls[0].question}</Text>
          {item.polls[0].poll_options.map((opt) => (
            <TouchableOpacity key={opt.id} style={styles.pollOption} onPress={() => handlePollVote(opt.id, item.id)}>
              <Text style={styles.pollOptionText}>{opt.option_text}</Text>
              <View style={styles.pollBarContainer}>
                <View style={[styles.pollBar, { width: `${Math.min((opt.vote_count / (item.pollVoteCount || 1)) * 100, 100)}%` }]} />
                <Text style={styles.pollVoteCount}>{opt.vote_count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.consultBtn} onPress={() => openCommentModal(item)}>
        <Text style={styles.consultBtnText}>View & Comment →</Text>
      </TouchableOpacity>

      {item.comments && item.comments.length > 0 && (
        <View style={styles.commentsContainer}>
          {item.comments.slice(0, 3).map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
              <Text style={styles.commentUser}>{comment.author_name || 'Community member'}</Text>
              <Text style={styles.commentText}>{comment.text}</Text>
              {comment.image_url && <Image source={{ uri: comment.image_url }} style={styles.commentImage} />}
              <View style={styles.commentActions}>
                <TouchableOpacity onPress={() => handleCommentLike(comment.id, item.id)} disabled={commentLikeLoading[comment.id]}>
                  <Ionicons name={comment.userLiked ? 'heart' : 'heart-outline'} size={18} color={comment.userLiked ? '#EF4444' : COLORS.gray600} />
                  <Text style={styles.commentLikeText}>{comment.likeCount || 0}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ----- Render feedback item -----
  const renderFeedbackItem = ({ item }) => (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackHeader}>
        <Text style={styles.feedbackTitle}>{item.title}</Text>
        <View style={[styles.feedbackStatus, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.feedbackStatusText, { color: getStatusColor(item.status) }]}>
            {item.status || 'Submitted'}
          </Text>
        </View>
      </View>
      <Text style={styles.feedbackDesc}>{item.description}</Text>
      <View style={styles.feedbackMeta}>
        <Text style={styles.feedbackCategory}>📂 {item.category || 'General'}</Text>
        <Text style={styles.feedbackTime}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'Resolved': return COLORS.success;
      case 'In Progress': return COLORS.warning;
      case 'Submitted': return COLORS.info;
      default: return COLORS.gray500;
    }
  };

  // ----- Sidebar -----
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>📂 Categories</Text>
      <TouchableOpacity style={[styles.categoryItem, selectedCategory === 'all' && styles.categoryActive]} onPress={() => setSelectedCategory('all')}>
        <Text style={[styles.categoryText, selectedCategory === 'all' && styles.categoryTextActive]}>All</Text>
      </TouchableOpacity>
      {categories.map((cat) => (
        <TouchableOpacity key={cat.id} style={[styles.categoryItem, selectedCategory === cat.name && styles.categoryActive]} onPress={() => setSelectedCategory(cat.name)}>
          <Ionicons name={cat.icon} size={18} color={COLORS.primary} />
          <Text style={[styles.categoryText, selectedCategory === cat.name && styles.categoryTextActive]}>{cat.name}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.topRanked}>
        <Text style={styles.sidebarTitle}>🏆 Top Ranked</Text>
        {consultations.slice(0, 5).map((item) => (
          <TouchableOpacity key={item.id} style={styles.topItem}>
            <Text style={styles.topTitle}>{item.title.substring(0, 20)}...</Text>
            <Text style={styles.topScore}>Score: {item.engagementScore}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {['officer', 'supervisor', 'admin', 'hr'].includes(user?.role) && (
      <View style={styles.statsSection}>
        <TouchableOpacity style={styles.statsBtn} onPress={handlePrint}>
          <Ionicons name="print-outline" size={18} color="#fff" />
          <Text style={styles.statsBtnText}>Print Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statsBtn, { backgroundColor: COLORS.success }]} onPress={handleDownloadCSV}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.statsBtnText}>Download CSV</Text>
        </TouchableOpacity>
      </View>
      )}
    </View>
  );

  // ----- Statistics & Export -----
  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
    else alert('Print available on web.');
  };

  const handleDownloadCSV = () => {
    if (typeof window === 'undefined') {
      alert('CSV download available on web.');
      return;
    }
    const headers = ['Title', 'Likes', 'Comments', 'Poll Votes', 'Engagement Score', 'Closes'];
    const rows = consultations.map(c => [
      c.title,
      c.likeCount || 0,
      c.commentCount || 0,
      c.pollVoteCount || 0,
      c.engagementScore || 0,
      new Date(c.closing_date).toDateString(),
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consultations_stats.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <PageHeader title="Public consultations" subtitle="Read proposals from NWSC Jinja and tell us what you think before decisions are made." icon="document-text-outline" overline="Participate" />
      <View style={styles.mainRow}>
        <View style={styles.mainContent}>

          {/* ✅ "PROPOSE A CONSULTATION" BUTTON */}
          <TouchableOpacity
            style={styles.proposeBtn}
            onPress={() => navigation.navigate('ProposeConsultation')}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.proposeBtnText}>Propose a Consultation</Text>
          </TouchableOpacity>

          <FlatList
            data={consultations}
            renderItem={renderConsultation}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<Outcomes style={{ marginTop: 24 }} />}
            ListEmptyComponent={
              <EmptyState
                icon="document-text-outline"
                title="No open consultations right now"
                message="When NWSC Jinja asks for public views on a project or service change, it will appear here. You can also propose a topic."
              />
            }
          />
        </View>
        {isDesktop && renderSidebar()}
      </View>

      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}><Ionicons name="close" size={24} color={COLORS.gray500} /></TouchableOpacity>
            </View>
            <TextInput style={styles.commentInput} placeholder="Write your comment..." value={commentText} onChangeText={setCommentText} multiline />
            <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={20} color={COLORS.primary} />
              <Text style={styles.imagePickerText}>{commentImage ? 'Image Selected' : 'Attach Image'}</Text>
            </TouchableOpacity>
            {commentImage && <Image source={{ uri: commentImage.uri }} style={styles.previewImage} />}
            <TouchableOpacity style={styles.submitCommentBtn} onPress={submitComment}>
              <Text style={styles.submitCommentText}>Submit Comment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {guest.modal}
    </View>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  mainRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 24, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24 },
  mainContent: { flex: 2 },
  sidebar: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.gray200, maxHeight: '100%', alignSelf: 'flex-start' },
  sidebarTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 8 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  categoryActive: { backgroundColor: COLORS.primary },
  categoryText: { fontSize: 14, color: COLORS.gray700, marginLeft: 8 },
  categoryTextActive: { color: '#fff' },
  topRanked: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.gray200, paddingTop: 12 },
  topItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  topTitle: { fontSize: 13, color: COLORS.gray700 },
  topScore: { fontSize: 11, color: COLORS.gray500 },
  statsSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.gray200, paddingTop: 12 },
  statsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 30, marginBottom: 8, justifyContent: 'center' },
  statsBtnText: { color: '#fff', fontWeight: '600', marginLeft: 6 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.gray800 },
  sectionSub: { fontSize: 14, color: COLORS.gray500, marginBottom: 12 },
  list: { paddingBottom: 20 },
  consultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  consultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeOpen: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 4 },
  badgeOpenText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  badgeClosing: { color: COLORS.warning, fontSize: 12, fontWeight: '600' },
  consultTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginTop: 8 },
  consultDesc: { color: COLORS.gray500, fontSize: 14, marginTop: 4 },
  consultImage: { width: '100%', height: 180, borderRadius: 10, marginTop: 10, marginBottom: 6, backgroundColor: COLORS.gray100 },
  engagementRow: { flexDirection: 'row', marginTop: 10, gap: 16 },
  engItem: { flexDirection: 'row', alignItems: 'center' },
  engText: { fontSize: 13, color: COLORS.gray600, marginLeft: 4 },
  reactionBar: { flexDirection: 'row', marginTop: 8, gap: 8 },
  reactionBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  reactionEmoji: { fontSize: 20 },
  reactionActive: { backgroundColor: '#EFF6FF', borderRadius: 20 },
  pollSection: { marginTop: 12, backgroundColor: COLORS.gray50, padding: 10, borderRadius: 10 },
  pollQuestion: { fontSize: 14, fontWeight: '600', color: COLORS.gray700, marginBottom: 6 },
  pollOption: { marginBottom: 6 },
  pollOptionText: { fontSize: 13, color: COLORS.gray600 },
  pollBarContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  pollBar: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  pollVoteCount: { fontSize: 12, color: COLORS.gray500, marginLeft: 6 },
  consultBtn: { marginTop: 10 },
  consultBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  commentsContainer: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.gray200, paddingTop: 8 },
  commentItem: { marginBottom: 8, backgroundColor: COLORS.gray50, padding: 8, borderRadius: 8 },
  commentUser: { fontWeight: 'bold', fontSize: 12, color: COLORS.gray700 },
  commentText: { fontSize: 13, color: COLORS.gray800 },
  commentImage: { width: 80, height: 80, borderRadius: 8, marginTop: 4 },
  commentActions: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  commentLikeText: { fontSize: 12, color: COLORS.gray600, marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray800 },
  commentInput: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top' },
  imagePickerBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  imagePickerText: { color: COLORS.primary, marginLeft: 6 },
  previewImage: { width: 100, height: 100, borderRadius: 8, marginTop: 8 },
  submitCommentBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 30, alignItems: 'center', marginTop: 12 },
  submitCommentText: { color: '#fff', fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  viewAll: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

  // ----- Feedback section -----
  feedbackSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: COLORS.gray200, paddingTop: 16 },
  feedbackSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  feedbackCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  feedbackTitle: { fontSize: 15, fontWeight: '600', color: COLORS.primary, flex: 1, marginRight: 8 },
  feedbackStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  feedbackStatusText: { fontSize: 11, fontWeight: '600' },
  feedbackDesc: { fontSize: 14, color: COLORS.gray600, marginBottom: 6 },
  feedbackMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  feedbackCategory: { fontSize: 12, color: COLORS.gray500 },
  feedbackTime: { fontSize: 12, color: COLORS.gray400 },

  proposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  proposeBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
});