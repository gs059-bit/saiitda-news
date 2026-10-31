// DB 역할 이름(admin·teacher_admin·reporter·reader)을 화면용 역할(admin·teacher·reporter·student)로 바꾼다
// database/comments-author.sql의 set_comment_author()도 같은 규칙을 쓰므로 바꿀 때 함께 고친다
const fromDb = { admin: 'admin', teacher_admin: 'teacher', reporter: 'reporter' };
export const viewRole = dbRole => fromDb[dbRole] || 'student';

// 가입 신청 화면의 역할 → profiles.requested_role
export const requestRole = { reporter: 'reporter', student: 'reader' };

export const roleLabel = { admin: '관리자', teacher: '선생님', reporter: '학생 기자', student: '일반 학생' };
