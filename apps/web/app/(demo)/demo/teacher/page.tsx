import { TeacherClient } from '@/app/(standalone)/evaluation-models/[id]/test/result/teacher/teacher-client';

export const metadata = { title: '先生用ビュー（デモ）| EvalEngine' };

export default function DemoTeacherPage() {
  return <TeacherClient />;
}
