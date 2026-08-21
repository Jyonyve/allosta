/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Language = 'ko' | 'en';

const LANGUAGE_KEY = 'allosta.language';

const ko: Record<string, string> = {
  Korean: '한국어',
  English: 'English',
  'Select language': '언어 선택',
  'Something went wrong. Please try again.': '문제가 발생했습니다. 다시 시도해 주세요.',
  'The request could not be completed.': '요청을 완료할 수 없습니다.',
  'Your results, made clearer': '검사 결과를 더 명확하게',
  'A thoughtful conversation about your health results.': '건강검진 결과에 대해 세심하게 상담해 드립니다.',
  'Review your available test results, choose a convenient time, and connect with the right advisor—without having to search for one.':
    '확인 가능한 검사 결과와 편한 시간을 선택하면 알맞은 상담사를 자동으로 연결해 드립니다.',
  'Secure, private, and centered on your questions.': '안전하게 보호하며, 궁금한 점을 중심으로 상담합니다.',
  'Consultation portal': '상담 포털',
  'Welcome back': '다시 만나 반갑습니다',
  'Sign in to review your results and consultations.': '로그인하여 검사 결과와 상담을 확인하세요.',
  'Email address': '이메일 주소',
  Password: '비밀번호',
  'Enter your password': '비밀번호를 입력하세요',
  'Signing in…': '로그인 중…',
  'Sign in': '로그인',
  'Trying the demo?': '데모를 체험하시나요?',
  'Choose a seeded portal account.': '미리 준비된 포털 계정을 선택하세요.',
  Customer: '고객',
  Advisor: '상담사',
  Operator: '운영자',
  Tested: '검사일',
  'Your consultation is reserved. You can review it in My consultations.':
    '상담이 예약되었습니다. 내 상담에서 확인할 수 있습니다.',
  'No test results are available yet': '확인 가능한 검사 결과가 없습니다',
  'Results you own or have approved consent to access will appear here.':
    '본인의 결과 또는 접근 동의를 받은 결과가 여기에 표시됩니다.',
  'Step 1': '1단계',
  'Choose a test result': '검사 결과 선택',
  '{count} available': '{count}개 이용 가능',
  'Result note': '검사 결과 메모',
  'Step 2': '2단계',
  'Choose a time': '시간 선택',
  'Korea time': '한국 시간',
  'Finding available advisors…': '예약 가능한 상담사를 찾는 중…',
  'Available dates': '예약 가능한 날짜',
  'Available appointment times': '예약 가능한 상담 시간',
  'Your selection': '선택한 일정',
  'Select an available time': '예약 가능한 시간을 선택하세요',
  'Reserving…': '예약 중…',
  'Reserve consultation': '상담 예약',
  'No available times right now': '현재 예약 가능한 시간이 없습니다',
  'Try another test result or check back after advisors add availability.':
    '다른 검사 결과를 선택하거나 상담사가 일정을 추가한 뒤 다시 확인해 주세요.',
  'The first request can take up to a minute while the free demo server wakes up.':
    '무료 데모 서버가 깨어나는 동안 첫 요청은 최대 1분까지 걸릴 수 있습니다.',
  'The server took too long to respond. The free demo server may have been waking up—please try again.':
    '서버 응답이 지연됩니다. 무료 데모 서버가 깨어나는 중일 수 있으니 잠시 후 다시 시도해 주세요.',
  'Network request failed. Check your connection and try again.':
    '네트워크 요청에 실패했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.',
  Reserved: '예약됨',
  'In progress': '작성 중',
  Completed: '완료',
  'No show': '노쇼',
  Cancelled: '취소됨',
  'Cancel your consultation on {date}?': '{date} 상담 예약을 취소하시겠습니까?',
  'Loading consultations…': '상담 목록을 불러오는 중…',
  'No consultations yet': '아직 상담이 없습니다',
  'Once you reserve a time, the appointment will appear here.': '상담을 예약하면 일정이 여기에 표시됩니다.',
  'Your schedule': '나의 일정',
  'My consultations': '내 상담',
  '{count} total': '총 {count}건',
  Examinee: '검사 대상자',
  Date: '날짜',
  'Consultation summary': '상담 요약',
  'Cancelling…': '취소 중…',
  'Cancel reservation': '예약 취소',
  'Customer portal': '고객 포털',
  'Book consultation': '상담 예약',
  'Log out': '로그아웃',
  'Good to see you, {name}': '{name}님, 반갑습니다',
  'Book a consultation': '상담 예약하기',
  'Your consultation history': '상담 내역',
  'Choose a result and a time. We’ll assign the right available advisor.':
    '검사 결과와 시간을 선택하면 가능한 상담사를 자동으로 배정해 드립니다.',
  'Review upcoming appointments and completed conversations.': '예정된 상담과 완료된 상담을 확인하세요.',
  'Advisor matched automatically': '상담사 자동 배정',
  'Based on your test type and availability': '검사 유형과 가능한 일정에 따라 배정됩니다',
  'Loading your health workspace…': '건강 상담 공간을 불러오는 중…',
  'Allosta consultation services': 'Allosta 상담 서비스',
  'Business timezone: Asia/Seoul': '서비스 기준 시간: 아시아/서울',
  'Advisor portal': '상담사 포털',
  Schedule: '상담 일정',
  Availability: '상담 가능 시간',
  'Advisor workspace': '상담사 업무 공간',
  'Manage your consultations and working availability.': '상담 일정과 상담 가능 시간을 관리하세요.',
  Upcoming: '예정',
  Drafts: '임시 저장',
  'Test types': '검사 유형',
  'Consulting specialties': '상담 전문 분야',
  'Consulting hours': '상담 가능 시간',
  'Your availability': '나의 상담 가능 시간',
  'Add availability': '상담 가능 시간 추가',
  'No availability registered': '등록된 상담 가능 시간이 없습니다',
  'Add your first date and time range using the form.': '양식에서 첫 날짜와 시간 범위를 추가하세요.',
  'Add one or more ranges for a date. Existing reservations are protected.':
    '날짜별로 하나 이상의 시간 범위를 추가할 수 있습니다. 기존 예약은 보호됩니다.',
  'Start time': '시작 시간',
  'End time': '종료 시간',
  Add: '추가',
  Edit: '수정',
  Delete: '삭제',
  Save: '저장',
  'Saving…': '저장 중…',
  'Consultation record': '상담 기록',
  'A record cannot be created for this consultation status.': '현재 상담 상태에서는 기록을 작성할 수 없습니다.',
  Summary: '요약',
  'Main question': '주요 질문',
  Memo: '메모',
  'Follow-up required': '후속 연락 필요',
  'Flag this consultation for another contact.': '추가 연락이 필요하도록 표시합니다.',
  'Follow-up note': '후속 연락 메모',
  'Interested products': '관심 상품',
  'Select products the customer expressed interest in.': '고객이 관심을 보인 상품을 선택하세요.',
  'Save draft': '임시 저장',
  'Finalize record': '기록 확정',
  'Final records cannot be edited.': '확정된 기록은 수정할 수 없습니다.',
  'No consultations assigned': '배정된 상담이 없습니다',
  'New reservations assigned to you will appear here.': '새로 배정된 예약이 여기에 표시됩니다.',
  'Assigned to you': '나에게 배정됨',
  Consultations: '상담',
  'Consultation detail': '상담 상세',
  Scheduled: '예약 일시',
  Requester: '요청자',
  'Test type': '검사 유형',
  'Test result note': '검사 결과 메모',
  'Loading advisor workspace…': '상담사 업무 공간을 불러오는 중…',
  'Allosta advisor services': 'Allosta 상담사 서비스',
  'End time must be later than start time on the same date.': '종료 시간은 같은 날짜의 시작 시간보다 늦어야 합니다.',
  'This range overlaps availability you already registered.': '이미 등록한 상담 가능 시간과 겹칩니다.',
  'Availability updated.': '상담 가능 시간이 수정되었습니다.',
  'Availability added.': '상담 가능 시간이 추가되었습니다.',
  'Availability deleted.': '상담 가능 시간이 삭제되었습니다.',
  'Delete availability on {date}?': '{date}의 상담 가능 시간을 삭제하시겠습니까?',
  '{count} ranges': '{count}개 시간대',
  'Deleting…': '삭제 중…',
  'Editing range': '시간대 수정',
  'New range': '새 시간대',
  'Update availability': '상담 가능 시간 수정',
  'Add one or more ranges for a date. Adjacent ranges are allowed.':
    '날짜별로 하나 이상의 시간대를 추가할 수 있으며, 서로 맞닿은 시간대도 허용됩니다.',
  'Cancel edit': '수정 취소',
  'Update range': '시간대 수정',
  'Add range': '시간대 추가',
  'Draft started': '초안 작성 중',
  'Add a consultation summary before finalizing.': '확정하기 전에 상담 요약을 입력하세요.',
  'Finalize this record? Final records cannot be edited.':
    '이 기록을 확정하시겠습니까? 확정된 기록은 수정할 수 없습니다.',
  'Record finalized and consultation completed.': '기록이 확정되고 상담이 완료되었습니다.',
  'Draft saved.': '초안이 저장되었습니다.',
  'Final record': '확정 기록',
  'Continue draft': '초안 이어서 작성',
  'Start documentation': '기록 작성 시작',
  'What did the customer want to understand?': '고객이 무엇을 알고 싶어 했나요?',
  'Summarize the conversation and guidance provided.': '상담 내용과 제공한 안내를 요약하세요.',
  'Advisor memo': '상담사 메모',
  'Internal notes for this consultation': '이 상담에 대한 내부 메모',
  'What should happen next?': '다음에 어떤 조치가 필요한가요?',
  'Select products the customer expressed interest in. This does not create an order.':
    '고객이 관심을 보인 상품을 선택하세요. 주문이 생성되지는 않습니다.',
  Product: '상품',
  'Finalizing…': '확정 중…',
  'Finalize & complete': '확정 및 완료',
  'Consultation schedule': '상담 일정',
  'Set your availability': '상담 가능 시간 설정',
  'Review assigned consultations and document each conversation.': '배정된 상담을 확인하고 상담 내용을 기록하세요.',
  'Register the date and time ranges when you can consult.': '상담 가능한 날짜와 시간대를 등록하세요.',
  'Supported test types': '지원 검사 유형',
  'Inactive advisor': '비활성 상담사',
  'Active advisor': '활성 상담사',
  'Operations portal': '운영자 포털',
  Dashboard: '대시보드',
  Consent: '동의 관리',
  'Operations center': '운영 센터',
  'Service at a glance': '서비스 현황',
  'Consultation oversight': '상담 운영 관리',
  'Consent verification': '동의 확인',
  'Monitor service health, advisor activity, and customer interest.':
    '서비스 상태, 상담사 활동, 고객 관심도를 확인하세요.',
  'Review every consultation and its operational context.': '모든 상담과 운영 정보를 검토하세요.',
  'Review externally confirmed consent before granting access.': '접근 권한 부여 전 외부 확인 동의를 검토하세요.',
  'Total consultations': '전체 상담',
  'All recorded appointments': '기록된 모든 상담',
  'Completion rate': '완료율',
  'Completed consultations': '완료된 상담',
  'Non-attendance rate': '미참석률',
  'Appointments missed': '불참한 상담',
  'Currently reserved': '현재 예약됨',
  'Service overview': '서비스 개요',
  'Consultation status': '상담 상태',
  'Daily control': '일일 운영',
  'Non-attendance processing': '미참석 처리',
  'Processing…': '처리 중…',
  'Team performance': '팀 성과',
  'Advisor activity': '상담사 활동',
  State: '상태',
  Completion: '완료율',
  'No-show': '노쇼',
  'Non-attendance': '미참석',
  Active: '활성',
  Inactive: '비활성',
  'No advisor activity is available yet.': '아직 상담사 활동 정보가 없습니다.',
  'Customer interest': '고객 관심도',
  Uncategorized: '미분류',
  'No products have been recorded yet.': '아직 기록된 상품이 없습니다.',
  'Select a consultation': '상담 선택',
  'Choose an appointment to inspect its operational record.': '운영 기록을 확인할 상담을 선택하세요.',
  'Consultation notes': '상담 메모',
  'No summary entered.': '입력된 요약이 없습니다.',
  'No consultation record has been started.': '아직 작성된 상담 기록이 없습니다.',
  'Operations log': '운영 기록',
  'All consultations': '전체 상담',
  'Filter by status': '상태별 필터',
  'All statuses': '모든 상태',
  'No consultations match this filter.': '이 조건에 맞는 상담이 없습니다.',
  'Access governance': '접근 권한 관리',
  'External consent queue': '외부 동의 확인 대기열',
  '{count} pending': '{count}건 대기 중',
  'Verify only after completing the lawful external process.': '적법한 외부 절차를 완료한 뒤에만 확인하세요.',
  'Approval grants the delegate access to the examinee’s test result.':
    '승인하면 대리인이 검사 대상자의 해당 결과에 접근할 수 있습니다.',
  'Requests access to': '접근 요청 대상',
  'Submitted {date}': '{date} 제출',
  'Verifying…': '확인 중…',
  'Verify consent': '동의 확인',
  'Queue clear': '대기열이 비어 있습니다',
  'There are no external consent requests awaiting verification.': '확인 대기 중인 외부 동의 요청이 없습니다.',
  'Loading operations workspace…': '운영 업무 공간을 불러오는 중…',
  'Allosta operations center': 'Allosta 운영 센터',
  'Consultation metrics': '상담 지표',
  Documenting: '작성 중',
  'Pending method': '확인 방법 대기 중',
  'Direct access': '직접 접근',
  'Result date': '검사일',
  APPROVED: '승인됨',
  PENDING: '대기 중',
  REJECTED: '거절됨',
  SELF_SERVICE: '본인 직접 동의',
  EXTERNAL_VERIFIED: '외부 절차 확인',
  'Comprehensive metabolic analysis': '종합 대사 분석',
  'Food intolerance analysis': '음식 과민증 분석',
  'Nutrition/heavy-metal health risk analysis': '영양·중금속 건강 위험 분석',
  'Metabolic health': '대사 건강',
  'Food response': '음식 반응',
  'Nutrition and health risk': '영양 및 건강 위험',
  'Omega-3 supplement': '오메가3 보충제',
  'Probiotic blend': '프로바이오틱스 혼합 제품',
  'Magnesium complex': '마그네슘 복합제',
  'Nutrition meal guide': '영양 식단 가이드',
  Supplement: '보충제',
  Program: '프로그램',
  'Not attended': '미참석',
  'Change reservation': '예약 변경',
  'Want to change reservation?': '예약을 변경하시겠습니까?',
  'Book a new time': '새 시간 예약',
  'Keep current': '기존 예약 유지',
  'Changing…': '변경 중…',
  'Previous time missed': '이전 예약 미참석',
  'Your consultation on {old} was not attended. Book {new} instead?':
    '{old} 상담이 미참석이었습니다. {new}으로 새로 예약하시겠습니까?',
  'You already have a consultation on {old}. Change it to {new}?':
    '{old}에 이미 상담이 있습니다. {new}으로 변경하시겠습니까?',
  'Your consultation was changed to the new time.': '상담이 새 시간으로 변경되었습니다.',
  'A consultation record for this result is already in progress and cannot be replaced.':
    '이미 작성 중인 상담 기록이 있어 예약을 변경할 수 없습니다.',
  'A consultation for this result is already in progress.':
    '이 검사 결과에 대한 상담이 이미 진행 중입니다.',
  'Your reservation on {date} was not attended. You can book a new time.':
    '{date} 예약이 미참석이었습니다. 새로운 시간을 예약할 수 있습니다.',
  'You already have a reservation for this result on {date}. Choose a new time to change it.':
    '이 검사 결과에 대해 {date} 예약이 이미 있습니다. 시간을 변경하려면 새 시간을 선택하세요.',
  'Run attendance check': '출석 확인 실행',
  'Mark overdue reserved consultations that were never documented as not attended. This operation is safe to run more than once.':
    '기한이 지난 예약 중 문서화되지 않은 상담을 미참석으로 처리합니다. 여러 번 실행해도 안전합니다.',
  '{count} consultation marked as not attended.': '{count}건의 상담을 미참석으로 처리했습니다.',
  '{count} consultations marked as not attended.': '{count}건의 상담을 미참석으로 처리했습니다.',
  'No overdue consultations found.': '기한이 지난 상담이 없습니다.',
  'None selected': '선택된 상품 없음',
  'Family access': '위임 상담',
  'Manage family access': '위임 상담 관리',
  Delegate: '위임자',
  'Grant or confirm access so someone else can consult about a result you own.':
    '본인 명의의 결과에 대해 다른 분이 상담받을 수 있도록 권한을 부여하거나 확인하세요.',
  'Delegate access': '위임 권한 부여',
  'Grant consultation access': '상담 위임 권한 부여',
  'Choose a result you own and the Allosta account email of the person who should be able to consult about it — a family member, for example.':
    '본인 명의의 검사 결과와, 대신 상담받을 분(가족 등)의 알로스타 계정 이메일을 입력하세요.',
  'You have no test results to delegate yet.': '위임할 수 있는 본인 명의의 검사 결과가 없습니다.',
  'Test result': '검사 결과',
  'Delegate email address': '위임받을 사람의 이메일',
  'Sending…': '보내는 중…',
  'Send delegation request': '위임 요청 보내기',
  'Delegation request created. Confirm it below to finish granting access.':
    '위임 요청이 생성되었습니다. 아래에서 최종 동의를 확인하면 위임이 완료됩니다.',
  'Awaiting your confirmation': '동의 확인 대기 중',
  'Confirming grants the delegate access to this result and lets them book a consultation about it.':
    '확인하면 위임받은 분이 이 결과에 접근하여 상담을 예약할 수 있습니다.',
  'Approve access': '위임 승인',
  'Approving…': '승인 중…',
  'Reject access': '위임 거절',
  'Rejecting…': '거절 중…',
  'No delegation requests are awaiting confirmation.': '확인 대기 중인 위임 요청이 없습니다.',
  'Demo: use delegator@demo.local as the delegate account.':
    '데모: 위임받는 계정으로 delegator@demo.local을 입력하세요.',
  'Delegate customer not found': '위임받을 고객을 찾을 수 없습니다.',
  'Owned test result not found': '본인 명의의 검사 결과를 찾을 수 없습니다.',
  'Self-delegation is not allowed': '본인에게는 위임할 수 없습니다.',
  'An active delegation already exists': '이미 활성화된 위임이 있습니다.',
  'Pending delegation not found': '확인 대기 중인 위임 요청을 찾을 수 없습니다.',
  'Only pending delegation can be verified': '대기 중인 위임만 확인할 수 있습니다.',
};

type I18nValue = string | number;
type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, I18nValue>) => string;
  formatDate: (value: string | Date, options: Intl.DateTimeFormatOptions) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, values?: Record<string, I18nValue>) {
  if (!values) return template;
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    return stored === 'en' ? 'en' : 'ko';
  });

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (key, values) => interpolate(language === 'ko' ? (ko[key] ?? key) : key, values),
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
          timeZone: 'Asia/Seoul',
          ...options,
        }).format(new Date(input)),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="language-switcher" role="group" aria-label={t('Select language')}>
      <button
        type="button"
        className={language === 'ko' ? 'active' : ''}
        aria-pressed={language === 'ko'}
        onClick={() => setLanguage('ko')}
      >
        {t('Korean')}
      </button>
      <button
        type="button"
        className={language === 'en' ? 'active' : ''}
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
    </div>
  );
}
