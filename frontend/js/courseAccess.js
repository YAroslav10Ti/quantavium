window.CourseAccess = {
  async checkAccess(course) {
    const c = String(course || '').toLowerCase();
    const me = await ApiClient.get('/auth/me');
    if (!me.success || !me.user) return false;
    const purchases = me.user.purchases || [];
    return purchases.some(p => (p.course || '').toLowerCase() === c);
  }
};
