import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { photoUrl, releasePhotoUrl } from '../../platform/photos';

// OPFS에 있는 사진 한 장을 화면에 건다.
//
// 두 가지를 반드시 지킨다.
// 1. blob URL은 만든 쪽이 되돌려준다. 흘리면 iOS는 페이지를 죽인다.
// 2. 화면에 가까워지기 전에는 만들지도 않는다. 기록 탭은 한 번에 300줄까지 그리는데,
//    거기서 사진 300장의 URL을 동시에 여는 것이 바로 웹 콘텐츠 프로세스가 죽는 그림이다.

function useNearViewport<T extends HTMLElement>(): [{ current: T | null }, boolean] {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect(); // 한 번 가까워지면 계속 붙잡아 둔다 — 스크롤마다 깜빡이지 않게
        }
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, near];
}

export function usePhoto(ref: string | null, enabled = true): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const [storedRevision, setStoredRevision] = useState(0);
  useEffect(() => {
    const onStored = (event: Event): void => {
      if ((event as CustomEvent<string>).detail === ref) setStoredRevision(n => n + 1);
    };
    window.addEventListener('ledger:photo-stored', onStored);
    return () => window.removeEventListener('ledger:photo-stored', onStored);
  }, [ref]);
  useEffect(() => {
    if (!ref || !enabled) {
      setUrl(null);
      return;
    }
    let live = true;
    let made: string | null = null;
    void photoUrl(ref).then((u) => {
      if (!live) {
        releasePhotoUrl(u);
        return;
      }
      made = u;
      setUrl(u);
    });
    return () => {
      live = false;
      releasePhotoUrl(made);
      setUrl(null);
    };
  }, [ref, enabled, storedRevision]);
  return url;
}

export function Photo({
  photo,
  alt = '',
  class: cls,
  style,
}: {
  photo: string | null;
  alt?: string;
  class?: string;
  style?: string;
}): JSX.Element | null {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const url = usePhoto(photo, near);
  if (!photo) return null;
  // 아직 못 읽었으면 자리만 잡아 둔다 — 목록이 덜컹거리지 않게
  return (
    <div ref={ref} class={cls ?? 'photo'} style={style}>
      {url && <img src={url} alt={alt} decoding="async" />}
    </div>
  );
}
