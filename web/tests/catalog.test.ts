import test from 'node:test';
import assert from 'node:assert/strict';
import {h} from 'preact';
import {render} from 'preact-render-to-string';
import {books,movies,creators} from '../../supabase/functions/ledger-catalog/catalog';
import {createCatalogHandler} from '../../supabase/functions/ledger-catalog/handler';
import {safeArtworkUrl,validCatalog} from '../../mitjul/src/core/catalog';
import {LibraryArtwork} from '../src/ui/parts/LibraryArtwork';
import {CatalogSearch} from '../src/ui/parts/CatalogSearch';

const book={title:'모모',authors:['미하엘 엔데'],isbn:'9781234567890',datetime:'2026-01-01',url:'https://search.daum.net/search?w=bookpage&q=9781234567890',thumbnail:'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=book'};
test('책 검색은 판본 ID·저자·표지를 반환하고 비정상 외부 링크를 제외한다',()=>{
  const result=books({documents:[book,{...book,url:'https://evil.test'},{...book,title:''}]});
  assert.equal(result.length,1);assert.equal(result[0].creator,'미하엘 엔데');
  assert.equal(result[0].catalog.year,'2026');assert.ok(validCatalog(result[0].catalog));
  assert.equal(books({documents:[{...book,thumbnail:'javascript:alert(1)'}]})[0].catalog.image,null);
});
test('영화·시리즈는 포스터와 연도를 분리하고 감독은 선택한 작품만 조회한다',()=>{
  const film=movies({results:[{id:157336,title:'인터스텔라',release_date:'2014-11-06',poster_path:'/poster.jpg'},{id:3,title:'성인',adult:true}]},'film');
  assert.equal(film.length,1);assert.equal(film[0].catalog.image,'https://image.tmdb.org/t/p/w342/poster.jpg');
  assert.ok(validCatalog(film[0].catalog));
  assert.equal(movies({results:[{id:1,name:'시리즈',poster_path:'https://bad.test'}]},'series')[0].catalog.image,null);
  assert.equal(creators({credits:{crew:[{job:'Director',name:'감독'},{job:'Writer',name:'작가'}]}},'film'),'감독');
});
test('동기화된 임의 주소는 이미지로 요청하지 않고 안전한 대체 아이콘을 표시한다',()=>{
  for(const uri of ['http://image.tmdb.org/x','https://image.tmdb.org.evil.test/x','https://user@image.tmdb.org/x','data:image/svg+xml,x','https://127.0.0.1/x']) assert.equal(safeArtworkUrl(uri),null);
  assert.doesNotMatch(render(h(LibraryArtwork,{kind:'book',image:'https://evil.test/track'})),/<img/);
  const html=render(h(LibraryArtwork,{kind:'film',image:'https://image.tmdb.org/t/p/w342/poster.jpg'}));
  assert.match(html,/referrerpolicy="no-referrer"/i);assert.match(html,/loading="lazy"/);
});
test('신규·기존 작품 검색에 직접 입력 대안과 제공처가 보인다',()=>{
  const html=render(h(CatalogSearch,{kind:'book',title:'모모',disabled:false,onPick(){}}));
  for(const word of ['등록할 작품 검색','모모','직접 입력','Kakao']) assert.ok(html.includes(word));
});
function request(body:unknown,token='user') {
  return new Request('https://local.test',{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
}
test('로그인 없는 검색·위조 토큰은 외부 API를 호출하지 않는다',async()=>{
  let called=0;
  const handler=createCatalogHandler({authenticate:async()=>null,kakaoKey:'secret',tmdbToken:'secret',fetcher:async()=>{called++;throw new Error();}});
  for(const token of ['','forged']) assert.equal((await handler(request({action:'search',kind:'book',q:'모모'},token))).status,401);
  assert.equal(called,0);
});
test('검색 서버는 고정 제공처·인증 헤더만 사용하고 동일 검색을 짧게 캐시한다',async()=>{
  let called=0;
  const handler=createCatalogHandler({authenticate:async()=> 'id',kakaoKey:'test-secret',tmdbToken:'other',fetcher:async(url,init)=>{
    called++;assert.equal(new URL(String(url)).host,'dapi.kakao.com');
    assert.equal(new Headers(init?.headers).get('Authorization'),'KakaoAK test-secret');
    assert.equal(new URL(String(url)).searchParams.get('query'),'모모');
    return Response.json({documents:[book]});
  }});
  const body={action:'search',kind:'book',q:'모모',review:'must not be transmitted'};
  assert.equal((await handler(request(body))).status,200);
  const text=await (await handler(request(body))).text();
  assert.doesNotMatch(text,/test-secret|must not/);assert.equal(called,1);
});
test('잘못된 요청·과다 요청·제공처 실패·설정 누락을 안전하게 표시한다',async()=>{
  const handler=createCatalogHandler({authenticate:async()=> 'id',kakaoKey:'',tmdbToken:''});
  assert.equal((await handler(request({action:'detail',kind:'film',id:'../account'}))).status,400);
  assert.equal((await handler(request({action:'search',kind:'book',q:'x'.repeat(121)}))).status,400);
  assert.equal((await handler(request(null))).status,400);
  const body={action:'search',kind:'book',q:'모모'};
  assert.equal((await handler(request(body))).status,503);
  for(let n=0;n<30;n++) await handler(request(body));
  assert.equal((await handler(request(body))).status,429);
  const fail=createCatalogHandler({authenticate:async()=> 'id',kakaoKey:'secret',tmdbToken:'secret',fetcher:async()=>{throw new Error('secret');}});
  const res=await fail(request(body)); assert.equal(res.status,502);assert.doesNotMatch(await res.text(),/secret/);
});
