import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import Svg, { Circle, Path, Rect, G, Text as SvgText, Line } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CHART_SIZE = Math.min(width - 80, 300);

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [feedbackData, setFeedbackData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('feedback').select('*');
    
    if (data) {
      setTotal(data.length);
      setFeedbackData(data);

      // Count by status
      const statusCount = { Submitted: 0, 'Under Review': 0, 'In Progress': 0, Resolved: 0 };
      data.forEach(item => {
        if (statusCount[item.status] !== undefined) {
          statusCount[item.status] += 1;
        }
      });
      const statusArr = Object.keys(statusCount).map(key => ({
        label: key,
        value: statusCount[key],
        color: key === 'Resolved' ? '#22C55E' : key === 'In Progress' ? '#F59E0B' : key === 'Under Review' ? '#3B82F6' : '#94A3B8',
      })).filter(item => item.value > 0);
      setStatusData(statusArr);

      // Count by category
      const categoryCount = { Education: 0, Sports: 0, Health: 0, Innovation: 0 };
      data.forEach(item => {
        if (categoryCount[item.category] !== undefined) {
          categoryCount[item.category] += 1;
        }
      });
      const categoryArr = Object.keys(categoryCount).map(key => ({
        label: key,
        value: categoryCount[key],
        color: key === 'Education' ? '#1E3A8A' : key === 'Sports' ? '#DC2626' : key === 'Health' ? '#16A34A' : '#8B5CF6',
      })).filter(item => item.value > 0);
      setCategoryData(categoryArr);
    }
    setLoading(false);
  };

  // Draw Pie Chart using SVG
  const renderPieChart = () => {
    if (statusData.length === 0) return <Text style={styles.emptyText}>No data</Text>;
    
    const totalValues = statusData.reduce((sum, item) => sum + item.value, 0);
    const radius = CHART_SIZE / 2 - 20;
    const center = CHART_SIZE / 2;
    let startAngle = -90;

    return (
      <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
        {statusData.map((item, index) => {
          const percentage = item.value / totalValues;
          const angle = percentage * 360;
          const endAngle = startAngle + angle;
          
          const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
          const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
          const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
          const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);
          
          const largeArcFlag = angle > 180 ? 1 : 0;
          
          const pathData = `
            M ${center} ${center}
            L ${x1} ${y1}
            A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
            Z
          `;
          
          const result = (
            <Path
              key={index}
              d={pathData}
              fill={item.color}
              stroke="#fff"
              strokeWidth="2"
            />
          );
          startAngle = endAngle;
          return result;
        })}
        <Circle cx={center} cy={center} r={radius * 0.4} fill="white" />
        <SvgText
          x={center}
          y={center - 8}
          textAnchor="middle"
          fontSize="20"
          fontWeight="bold"
          fill="#1E3A8A"
        >
          {total}
        </SvgText>
        <SvgText
          x={center}
          y={center + 16}
          textAnchor="middle"
          fontSize="12"
          fill="#64748B"
        >
          Total
        </SvgText>
      </Svg>
    );
  };

  // Draw Bar Chart using SVG
  const renderBarChart = () => {
    if (categoryData.length === 0) return <Text style={styles.emptyText}>No data</Text>;
    
    const maxValue = Math.max(...categoryData.map(item => item.value));
    const barWidth = (CHART_SIZE - 60) / categoryData.length;
    const chartHeight = 150;

    return (
      <Svg width={CHART_SIZE} height={chartHeight + 40}>
        {categoryData.map((item, index) => {
          const x = 30 + index * (barWidth + 10);
          const barHeight = (item.value / maxValue) * (chartHeight - 20);
          const y = chartHeight - barHeight + 10;
          
          return (
            <G key={index}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={item.color}
                rx={4}
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight + 25}
                textAnchor="middle"
                fontSize="12"
                fill="#334155"
              >
                {item.label.substring(0, 4)}
              </SvgText>
              <SvgText
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#1E293B"
              >
                {item.value}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.heading}>📊 Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.subheading}>Real-time overview of citizen feedback</Text>

      <View style={styles.totalBox}>
        <Text style={styles.totalNumber}>{total}</Text>
        <Text style={styles.totalLabel}>Total Submissions</Text>
      </View>

      {statusData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📈 By Status</Text>
          {renderPieChart()}
          <View style={styles.legendContainer}>
            {statusData.map((item, idx) => (
              <View key={idx} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}: {item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {categoryData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📊 By Category</Text>
          {renderBarChart()}
          <View style={styles.legendContainer}>
            {categoryData.map((item, idx) => (
              <View key={idx} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}: {item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.feedbackList}>
        <Text style={styles.chartTitle}>📋 Recent Feedback</Text>
        {feedbackData.slice(0, 5).map((item, idx) => (
          <View key={idx} style={styles.feedbackItem}>
            <Text style={styles.feedbackTitle}>{item.title}</Text>
            <View style={styles.feedbackMeta}>
              <Text style={[styles.feedbackStatus, 
                { color: item.status === 'Resolved' ? '#22C55E' : item.status === 'In Progress' ? '#F59E0B' : '#3B82F6' }
              ]}>
                ● {item.status}
              </Text>
              <Text style={styles.feedbackCategory}>📌 {item.category}</Text>
            </View>
          </View>
        ))}
        {feedbackData.length === 0 && (
          <Text style={styles.emptyText}>No feedback submitted yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748B' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#1E3A8A' },
  subheading: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  totalBox: {
    backgroundColor: '#1E3A8A',
    padding: 25,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalNumber: { color: 'white', fontSize: 40, fontWeight: 'bold' },
  totalLabel: { color: '#CBD5E1', fontSize: 16, marginTop: 5 },
  chartCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  chartTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, alignSelf: 'flex-start' },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginVertical: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  legendText: { fontSize: 13, color: '#334155' },
  feedbackList: { backgroundColor: 'white', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  feedbackItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  feedbackTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  feedbackMeta: { flexDirection: 'row', marginTop: 4, gap: 15 },
  feedbackStatus: { fontSize: 13, fontWeight: '500' },
  feedbackCategory: { fontSize: 13, color: '#64748B' },
  emptyText: { color: '#94A3B8', textAlign: 'center', padding: 20 },
});