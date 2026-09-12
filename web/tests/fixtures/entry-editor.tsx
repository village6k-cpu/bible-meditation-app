import { render } from 'preact';
import { useState } from 'preact/hooks';
import type { Entry } from '@core/types';
import { EntryEditor, draftOf, type EntryDraft } from '../../src/ui/parts/EntryEditor';
import '../../src/ui/styles.css';

// 실제 편집 컴포넌트만 그린다. 사용자 DB·사진 파일·서버에는 접근하지 않는다.
const entry = {type:'verse', title:null, subtitle:'시편 23:1', quote:'기존에 적은 인용문',
  body:'유형을 바꾸어도\n\n이 글과 사진은 그대로 남습니다.', page:null, image_uri:'/icon-180.png', source_id:null} as Entry;
function Fixture() {
  const [draft, setDraft] = useState<EntryDraft>({...draftOf(entry, ['생각']), type:'writing'});
  return <div class="app"><div class="modal-root"><div class="sheet">
    <div class="sheet-head"><button class="quiet">취소</button><button class="act">저장</button></div>
    <div class="sheet-body"><EntryEditor entry={entry} draft={draft} busy={false} preview={null}
      onChange={setDraft} onPick={()=>{}} onRemove={()=>setDraft({...draft, image_uri:null})} /></div>
  </div></div></div>;
}
render(<Fixture />, document.getElementById('root')!);
new ResizeObserver(() => {
  const editor = document.querySelector('.entry-editor')!;
  parent.postMessage({kind:'editor-size', width:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth, editorWidth:editor.clientWidth,
    editorScrollWidth:editor.scrollWidth, photo:document.querySelector('.edit-photo-preview')?.clientWidth,
    sheet:document.querySelector('.sheet')?.clientWidth}, location.origin);
}).observe(document.documentElement);
