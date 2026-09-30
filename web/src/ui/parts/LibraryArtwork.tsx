import { useState } from 'preact/hooks';
import { safeArtworkUrl } from '@core/catalog';
import type { MediaKind } from '@core/library';
import { Icon } from '../icons';

export function LibraryArtwork({kind,image}:{kind:MediaKind;image?:string|null}) {
  const [failed,setFailed]=useState<string|null>(null);
  const src=safeArtworkUrl(image);
  return <div class={`library-art ${kind} ${src&&failed!==src?'has-cover':''}`} aria-hidden="true">
    {src&&failed!==src?<img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>
      :<Icon name={kind==='book'?'book':kind==='film'||kind==='series'?'film':kind==='music'||kind==='podcast'?'music':kind==='article'?'writing':'play'}/>}
  </div>;
}
