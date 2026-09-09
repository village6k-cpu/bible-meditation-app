import { Redirect } from 'expo-router';

// 중앙 '남기기' 버튼의 자리만 지키는 화면 — 탭 press는 _layout에서 가로채
// /compose 모달을 연다. 딥링크 등으로 직접 도달하면 오늘 탭으로 돌려보낸다.
export default function CaptureTabPlaceholder() {
  return <Redirect href="/" />;
}
