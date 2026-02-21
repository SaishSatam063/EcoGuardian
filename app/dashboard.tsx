
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  FlatList,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Circle as SvgCircle, Line, Text as SvgText } from 'react-native-svg';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 80;

interface Report {
  id: string;
  category: string;
  description: string;
  status: 'pending' | 'verified' | 'solved';
  cashback: number;
  date: string;
  imageUri?: string;
}

const SAMPLE_STUDENTS = [
  { id: '1', name: 'Arjun Mehta', institution: 'IIT Delhi', reports: 24, cashback: 1200 },
  { id: '2', name: 'Priya Sharma', institution: 'NIT Trichy', reports: 19, cashback: 950 },
  { id: '3', name: 'Rahul Verma', institution: 'BITS Pilani', reports: 17, cashback: 850 },
  { id: '4', name: 'Sneha Patel', institution: 'IIT Bombay', reports: 15, cashback: 750 },
  { id: '5', name: 'Amit Kumar', institution: 'DTU', reports: 13, cashback: 650 },
  { id: '6', name: 'Kavya Nair', institution: 'VIT', reports: 11, cashback: 550 },
];

const MONTHLY_DATA = [
  { month: 'Jul', value: 120 },
  { month: 'Aug', value: 200 },
  { month: 'Sep', value: 150 },
  { month: 'Oct', value: 310 },
  { month: 'Nov', value: 250 },
  { month: 'Dec', value: 180 },
];

const ACTIVITY_DATA = [
  { month: 'Jul', value: 3 },
  { month: 'Aug', value: 5 },
  { month: 'Sep', value: 4 },
  { month: 'Oct', value: 7 },
  { month: 'Nov', value: 6 },
  { month: 'Dec', value: 4 },
];

function BarChart({ data, color, label, unit }: { data: { month: string; value: number }[]; color: string; label: string; unit: string }) {
  const maxVal = Math.max(...data.map((d) => d.value));
  const chartHeight = 140;
  const barWidth = (CHART_WIDTH - 40) / data.length - 8;

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.label}>{label}</Text>
      <Svg width={CHART_WIDTH} height={chartHeight + 30}>
        <Line x1="20" y1={chartHeight} x2={CHART_WIDTH - 20} y2={chartHeight} stroke={Colors.cardBorder} strokeWidth="1" />
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * (chartHeight - 20);
          const x = 30 + i * ((CHART_WIDTH - 60) / (data.length - 1)) - barWidth / 2;
          return (
            <React.Fragment key={d.month}>
              <Rect
                x={x}
                y={chartHeight - barH}
                width={barWidth}
                height={barH}
                rx={4}
                fill={color}
                opacity={0.85}
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - barH - 6}
                fill={Colors.textSecondary}
                fontSize="10"
                textAnchor="middle"
                fontFamily="Poppins_500Medium"
              >
                {unit}{d.value}
              </SvgText>
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight + 16}
                fill={Colors.textMuted}
                fontSize="10"
                textAnchor="middle"
              >
                {d.month}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function StudentCard({ student, index }: { student: typeof SAMPLE_STUDENTS[0]; index: number }) {
  const initials = student.name
    .split(' ')
    .map((w) => w[0])
    .join('');
  const bgColors = ['#1B8A4A', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#1ABC9C'];

  return (
    <View style={studentStyles.card}>
      <View style={[studentStyles.avatar, { backgroundColor: bgColors[index % bgColors.length] }]}>
        <Text style={studentStyles.initials}>{initials}</Text>
      </View>
      <Text style={studentStyles.name} numberOfLines={1}>{student.name}</Text>
      <Text style={studentStyles.inst} numberOfLines={1}>{student.institution}</Text>
      <View style={studentStyles.statsRow}>
        <View style={studentStyles.statItem}>
          <Ionicons name="document-text" size={12} color={Colors.primary} />
          <Text style={studentStyles.statVal}>{student.reports}</Text>
        </View>
        <View style={studentStyles.statItem}>
          <Ionicons name="cash" size={12} color={Colors.gold} />
          <Text style={studentStyles.statVal}>{student.cashback}</Text>
        </View>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('ecotrack_reports');
      if (stored) setReports(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function onRefresh() {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  }

  const solvedCount = reports.filter((r) => r.status === 'solved').length;
  const totalCashback = reports.reduce((sum, r) => sum + (r.status === 'solved' ? r.cashback : 0), 0);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]}
          style={[styles.headerGradient, { paddingTop: insets.top + webTopInset + 16 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.decorDot1} />
          <View style={styles.decorDot2} />

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.userName}>{user?.name || 'Student'}</Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/profile');
              }}
              style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
            >
              <Ionicons name="person" size={22} color={Colors.white} />
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="file-document-outline" size={22} color={Colors.white} />
              <Text style={styles.statNumber}>{reports.length}</Text>
              <Text style={styles.statLabel}>Reports</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color={Colors.white} />
              <Text style={styles.statNumber}>{solvedCount}</Text>
              <Text style={styles.statLabel}>Solved</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cash-outline" size={22} color={Colors.white} />
              <Text style={styles.statNumber}>{totalCashback}</Text>
              <Text style={styles.statLabel}>Cashback</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="ribbon-outline" size={22} color={Colors.white} />
              <Text style={styles.statNumber}>{solvedCount}</Text>
              <Text style={styles.statLabel}>Certificates</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && { transform: [{ scale: 0.97 }] }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/verify');
              }}
            >
              <LinearGradient
                colors={[Colors.primary, '#2ECC71']}
                style={styles.actionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="camera" size={28} color={Colors.white} />
                <Text style={styles.actionText}>Upload Photo</Text>
                <Text style={styles.actionSub}>Geotagged issue</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && { transform: [{ scale: 0.97 }] }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/report');
              }}
            >
              <LinearGradient
                colors={['#3498DB', '#2980B9']}
                style={styles.actionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="create" size={28} color={Colors.white} />
                <Text style={styles.actionText}>Report Issue</Text>
                <Text style={styles.actionSub}>Fill details</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {reports.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Recent Reports</Text>
              {reports.slice(0, 3).map((report) => (
                <View key={report.id} style={styles.reportCard}>
                  <View style={[styles.reportStatus, {
                    backgroundColor: report.status === 'solved' ? '#E8F5E9' : report.status === 'verified' ? '#FFF3E0' : '#F3E5F5',
                  }]}>
                    <Ionicons
                      name={report.status === 'solved' ? 'checkmark-circle' : report.status === 'verified' ? 'time' : 'hourglass'}
                      size={18}
                      color={report.status === 'solved' ? Colors.success : report.status === 'verified' ? Colors.warning : Colors.chartPurple}
                    />
                  </View>
                  <View style={styles.reportInfo}>
                    <Text style={styles.reportCategory}>{report.category}</Text>
                    <Text style={styles.reportDesc} numberOfLines={1}>{report.description}</Text>
                  </View>
                  <View style={styles.reportRight}>
                    <Text style={[styles.reportStatusText, {
                      color: report.status === 'solved' ? Colors.success : report.status === 'verified' ? Colors.warning : Colors.chartPurple,
                    }]}>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </Text>
                    {report.status === 'solved' && (
                      <Text style={styles.reportCashback}>+{report.cashback}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Your Impact</Text>
            <View style={styles.chartCard}>
              <BarChart data={MONTHLY_DATA} color={Colors.primary} label="Cashback Earned" unit="" />
            </View>
            <View style={styles.chartCard}>
              <BarChart data={ACTIVITY_DATA} color={Colors.chartBlue} label="Reports Filed" unit="" />
            </View>
          </View>

          <View style={styles.sliderSection}>
            <Text style={styles.sectionTitle}>Top Contributors</Text>
            <FlatList
              horizontal
              data={SAMPLE_STUDENTS}
              renderItem={({ item, index }) => <StudentCard student={item} index={index} />}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sliderContent}
            />
          </View>

          <View style={styles.aboutSection}>
            <LinearGradient
              colors={['#E8F5E9', '#C8E6C9']}
              style={styles.aboutCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.aboutIconRow}>
                <MaterialCommunityIcons name="leaf" size={28} color={Colors.primary} />
                <Text style={styles.aboutTitle}>About EcoTrack</Text>
              </View>
              <Text style={styles.aboutText}>
                EcoTrack is a digital platform that tracks, verifies, and rewards environmental safety
                actions performed by students from various institutions. Log eco-friendly activities
                like waste segregation and tree plantation, get verified, and earn cashback rewards
                and certificates for your green initiatives.
              </Text>
              <View style={styles.aboutFeatures}>
                <View style={styles.aboutFeatureItem}>
                  <Feather name="upload" size={16} color={Colors.primary} />
                  <Text style={styles.aboutFeatureText}>Upload geotagged photos</Text>
                </View>
                <View style={styles.aboutFeatureItem}>
                  <Feather name="check-circle" size={16} color={Colors.primary} />
                  <Text style={styles.aboutFeatureText}>AI-powered verification</Text>
                </View>
                <View style={styles.aboutFeatureItem}>
                  <Feather name="award" size={16} color={Colors.primary} />
                  <Text style={styles.aboutFeatureText}>Earn certificates & cashback</Text>
                </View>
                <View style={styles.aboutFeatureItem}>
                  <Feather name="users" size={16} color={Colors.primary} />
                  <Text style={styles.aboutFeatureText}>Connect with organizations</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { paddingVertical: 8 },
  label: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingLeft: 4,
  },
});

const studentStyles = StyleSheet.create({
  card: {
    width: 130,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  initials: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: Colors.white,
  },
  name: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
    textAlign: 'center',
  },
  inst: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statVal: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.textSecondary,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1 },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  decorDot1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -20,
    right: -30,
  },
  decorDot2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 10,
    left: -20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {},
  greeting: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: Colors.white,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 12,
    marginHorizontal: 3,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: Colors.white,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
    minHeight: 120,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
    marginTop: 4,
  },
  actionSub: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.8)',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    marginBottom: 14,
  },
  recentSection: { marginBottom: 24 },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  reportStatus: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportInfo: { flex: 1 },
  reportCategory: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
  },
  reportDesc: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },
  reportRight: { alignItems: 'flex-end' },
  reportStatusText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  reportCashback: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    color: Colors.success,
    marginTop: 2,
  },
  chartSection: { marginBottom: 24 },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sliderSection: { marginBottom: 24 },
  sliderContent: { paddingRight: 20 },
  aboutSection: { marginBottom: 24 },
  aboutCard: {
    borderRadius: 20,
    padding: 22,
  },
  aboutIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: Colors.primaryDark,
  },
  aboutText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  aboutFeatures: { gap: 10 },
  aboutFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutFeatureText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: Colors.text,
  },
});
