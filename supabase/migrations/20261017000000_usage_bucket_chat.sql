-- MS3: 대화형 한도 버킷 (enum 값 추가는 사용하는 함수와 다른 트랜잭션에서 커밋되어야 한다)
alter type public.usage_bucket add value if not exists 'chat_day';
alter type public.usage_bucket add value if not exists 'chat_minute';
