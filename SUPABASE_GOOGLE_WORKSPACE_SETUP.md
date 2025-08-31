# Supabase + Google Workspace 이메일 설정 가이드

이 가이드는 Supabase에서 Google Workspace를 사용하여 팀 초대 이메일을 발송하도록 설정하는 방법을 설명합니다.

## 1. Google Workspace SMTP 설정

### 1.1 Google Workspace Admin Console에서 SMTP 릴레이 서비스 설정

1. [Google Admin Console](https://admin.google.com)에 로그인
2. **앱 > Google Workspace > Gmail > 라우팅** 으로 이동
3. **SMTP 릴레이 서비스** 클릭
4. 새 릴레이 설정 추가:
   - **허용된 전송자**: 등록된 App 사용자만
   - **인증**: SMTP 인증 필요
   - **암호화**: TLS 암호화 필요
   - **허용된 IP 범위**: Supabase 서버 IP (또는 모든 IP)

### 1.2 App Password 생성 (2단계 인증 사용 시)

1. Google 계정 설정으로 이동
2. **보안 > 2단계 인증 > 앱 비밀번호**
3. Supabase용 앱 비밀번호 생성
4. 생성된 비밀번호 저장

## 2. Supabase 이메일 설정

### 2.1 Supabase Dashboard 설정

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인
2. 프로젝트 선택 > **Authentication > Settings**
3. **SMTP Settings** 섹션에서:
   - **Enable custom SMTP**: ON
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587` (TLS) 또는 `465` (SSL)
   - **SMTP Username**: Google Workspace 이메일 (예: `noreply@sivera.app`)
   - **SMTP Password**: Google 계정 비밀번호 또는 앱 비밀번호
   - **SMTP From**: `Sivera <noreply@sivera.app>`

### 2.2 이메일 템플릿 설정

Supabase Dashboard > **Authentication > Email Templates**에서:

#### Invite User Template:

```html
<h2>팀 초대장</h2>
<p>안녕하세요,</p>
<p>{{ .InviterName }}님이 {{ .TeamName }} 팀에 초대했습니다.</p>
<p><a href="{{ .ConfirmationURL }}">초대 수락하기</a></p>
<p>이 초대장은 7일 후에 만료됩니다.</p>
<p>감사합니다,<br />Sivera 팀</p>
```

## 3. 환경변수 설정

`.env.local` 파일에 필요한 환경변수가 설정되어 있는지 확인:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 사이트 URL
NEXT_PUBLIC_SITE_URL=https://sivera.app
```

## 4. 코드 변경사항

### 4.1 팀 초대 로직 변경

- ✅ Resend Edge Function 제거
- ✅ `supabase.auth.admin.inviteUserByEmail()` 사용
- ✅ Service Role Key로 admin 권한 획득

### 4.2 변경된 파일들

- `app/[lang]/(private)/team/actions.ts`: Supabase Auth 사용
- `app/api/team/invite/route.ts`: 삭제됨 (불필요)
- `supabase/functions/resend/`: 삭제됨

## 5. 테스트 방법

1. 팀 페이지에서 새 멤버 초대
2. Supabase Dashboard > Authentication > Users에서 초대된 사용자 확인
3. 이메일 수신 확인
4. 초대 링크 클릭하여 가입 완료

## 6. 주의사항

- Google Workspace의 일일 이메일 발송 제한 확인
- SPF/DKIM 레코드 설정으로 이메일 전달률 향상
- 이메일 템플릿에서 사용할 수 있는 변수는 Supabase 문서 참조

## 7. 문제 해결

### 이메일이 발송되지 않는 경우:

1. Supabase Dashboard > Logs에서 Auth 로그 확인
2. Google Admin Console에서 SMTP 로그 확인
3. 스팸 폴더 확인
4. SMTP 인증 정보 재확인

### 자주 발생하는 오류:

- `535 Authentication failed`: SMTP 인증 정보 확인
- `550 Relay not permitted`: SMTP 릴레이 설정 확인
- `Message blocked`: 스팸 필터 또는 정책 확인
