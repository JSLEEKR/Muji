# Changelog

## [0.4.0] - 2026-03-24

### Added
- **ElevenLabs 사전 녹음 음성**: `sounds/voices/{lang}/` 에 en/ko/ja 음성 파일 39개 생성
  - 알림 이벤트별 사전 녹음 파일 우선 재생 (TTS 불필요, 오프라인에서도 동작)
  - TTS 폴백: 사전 녹음 파일이 없는 이벤트는 기존 edge-tts로 합성
- **동적 프로젝트명 메시지**: `session_start`/`session_end`에서 현재 디렉토리명을 프로젝트명으로 포함
  - "git-Muji 프로젝트, 시작할게." / "git-Muji 프로젝트 작업 마무리됐어."
  - edge-tts(무료)로 실시간 합성, `notifications.dynamic_project_name` 옵션으로 on/off
- **정시 알림 (Hourly Chime)**: 매 시간마다 랜덤 메시지로 시간 경과 알림
  - "벌써 한 시간 지났어. 잘 되고 있어?" 등 3종
- **Idle 감지 알림**: 사용자 응답이 30분 이상 없을 때 케어 메시지
  - "좀 쉬어가는 게 어때? 잠깐 산책하고 와." 등 5종
  - 모든 handler에서 활동 타임스탬프 자동 기록 (`muji-last-activity.json`)
- **Wellness 데몬**: 포모도로 데몬에 통합, `node scripts/core/pomodoro.js wellness`로 독립 실행도 가능
- **음성 생성 도구**: `scripts/tools/generate-voices.js` — ElevenLabs API로 커스텀 음성 파일 생성

### Fixed
- **BGM 다중 윈도우 중복 재생 방지**: PID 파일 기반 글로벌 싱글톤 (`muji-bgm.pid`)
