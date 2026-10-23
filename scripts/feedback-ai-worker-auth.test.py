"""Offline fixtures only: fake HOME/auth, mocked subprocess; never call real bridge/model/CLI."""
import importlib.util,io,json,os,subprocess,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
P=Path(__file__).with_name('feedback-ai-worker.py')
spec=importlib.util.spec_from_file_location('worker_candidate',P);worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)
class AuthCompat(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='wechurch-auth-fixture-');self.addCleanup(self.tmp.cleanup);self.home=Path(self.tmp.name);self.file=self.home/'.railway/config.json';self.file.parent.mkdir()
  for cm in [patch.object(worker.Path,'home',return_value=self.home),patch.dict(os.environ,{'HOME':str(self.home),'PATH':'fixture-bin','RAILWAY_TOKEN':'fixture-unrelated-env','RAILWAY_API_TOKEN':'fixture-unrelated-env'},clear=True),patch.object(worker.time,'time',return_value=1000),patch.object(worker.subprocess,'run',side_effect=AssertionError('external subprocess forbidden')),patch.object(worker,'bridge',side_effect=AssertionError('real bridge forbidden')),patch.object(worker,'analyze',side_effect=AssertionError('real model forbidden'))]:
   value=cm.start();self.addCleanup(cm.stop)
   if isinstance(value,unittest.mock.MagicMock) and cm.attribute=='run':self.run_mock=value
 def config(self,user):
  data=json.dumps({'user':user,'projects':{'fixture':'preserved'}},indent=2).encode();self.file.write_bytes(data);return data
 def failure(self,user,reason='railway_login_required',**kwargs):
  before=self.config(user)
  with self.assertRaisesRegex(worker.SafeFailure,'^'+reason+'$'):worker.railway_env(**kwargs)
  self.assertEqual(self.file.read_bytes(),before);self.run_mock.assert_not_called()
 def test_legacy_token_env_only_no_persistence(self):
  before=self.config({'token':'fixture-legacy-token'})
  with patch.object(worker.os,'replace',side_effect=AssertionError('legacy must not persist')),patch('sys.stdout',new_callable=io.StringIO) as out,patch('sys.stderr',new_callable=io.StringIO) as err:
   env=worker.railway_env()
  self.assertEqual(env['RAILWAY_API_TOKEN'],'fixture-legacy-token');self.assertEqual(env['RAILWAY_NO_AUTO_UPDATE'],'1');self.assertNotIn('RAILWAY_TOKEN',env);self.assertEqual(self.file.read_bytes(),before);self.assertEqual(out.getvalue()+err.getvalue(),'');self.run_mock.assert_not_called()
 def test_environment_only_is_not_a_login_fallback(self):self.failure({})
 def test_missing_and_invalid_legacy_tokens_fail(self):
  for user in [{},{'token':''},{'token':'  '},{'token':1},{'token':' fixture-leading-space'}]:
   with self.subTest(shape=list(user)):self.failure(user)
 def test_any_oauth_field_blocks_legacy_compatibility(self):
  for key in ['accessToken','refreshToken','tokenExpiresAt']:
   with self.subTest(key=key):self.failure({'token':'fixture-legacy-token',key:0 if key=='tokenExpiresAt' else None})
 def test_expired_oauth_missing_refresh_cannot_fall_back_to_legacy(self):self.failure({'accessToken':'fixture-expired','token':'fixture-legacy-token','tokenExpiresAt':900})
 def test_force_refresh_does_not_invent_legacy_refresh(self):self.failure({'token':'fixture-legacy-token'},force_refresh=True)
 def test_valid_oauth_unchanged_no_refresh_or_write(self):
  before=self.config({'accessToken':'fixture-current-access','refreshToken':'fixture-refresh','tokenExpiresAt':5000,'token':None});env=worker.railway_env();self.assertEqual(env['RAILWAY_API_TOKEN'],'fixture-current-access');self.assertEqual(self.file.read_bytes(),before);self.run_mock.assert_not_called()
 def refresh(self,result,returncode=0,change_file=False):
  before=self.config({'accessToken':'fixture-expired-access','refreshToken':'fixture-old-refresh','tokenExpiresAt':900,'token':None})
  def fake(args,**kwargs):
   self.assertEqual(args[:3],['node','--input-type=module','-e']);self.assertNotIn('fixture-old-refresh',' '.join(args));self.assertEqual(json.loads(kwargs['input']),{'refreshToken':'fixture-old-refresh'});self.assertNotIn('RAILWAY_API_TOKEN',kwargs['env']);self.assertNotIn('RAILWAY_TOKEN',kwargs['env'])
   if change_file:self.file.write_text(json.dumps({'user':{'token':'fixture-concurrent-login'}}))
   return SimpleNamespace(returncode=returncode,stdout=result if isinstance(result,str) else json.dumps(result))
  self.run_mock.side_effect=fake;return before
 def test_refresh_success_preserves_original_oauth_update_and_owner600(self):
  self.refresh({'access_token':'fixture-new-access','expires_in':3600,'refresh_token':'fixture-new-refresh'});env=worker.railway_env();saved=json.loads(self.file.read_text());self.assertEqual(env['RAILWAY_API_TOKEN'],'fixture-new-access');self.assertEqual(saved['user'],{'accessToken':'fixture-new-access','refreshToken':'fixture-new-refresh','tokenExpiresAt':4600,'token':None});self.assertEqual(saved['projects'],{'fixture':'preserved'});self.assertEqual(self.file.stat().st_mode&0o777,0o600);self.run_mock.assert_called_once()
 def test_refresh_success_without_rotated_refresh_keeps_existing_refresh(self):
  self.refresh({'access_token':'fixture-new-access','expires_in':60});worker.railway_env();self.assertEqual(json.loads(self.file.read_text())['user']['refreshToken'],'fixture-old-refresh')
 def test_refresh_failure_does_not_replace_original_config(self):
  cases=[({'access_token':'fixture-unused','expires_in':3600},1),('not-json',0),({'access_token':'','expires_in':3600},0),({'access_token':'fixture-unused','expires_in':0},0),({'access_token':'fixture-unused','expires_in':True},0),({'access_token':'fixture-unused','expires_in':3600,'refresh_token':9},0)]
  for value,status in cases:
   with self.subTest(case=status,shape=type(value).__name__):
    before=self.refresh(value,returncode=status)
    with self.assertRaisesRegex(worker.SafeFailure,'^railway_login_refresh_failed$'):worker.railway_env()
    self.assertEqual(self.file.read_bytes(),before)
 def test_refresh_cas_drift_preserves_concurrent_login(self):
  self.refresh({'access_token':'fixture-new-access','expires_in':3600},change_file=True)
  with patch.object(worker.os,'replace',side_effect=AssertionError('CAS must not overwrite')):
   with self.assertRaisesRegex(worker.SafeFailure,'^railway_login_refresh_failed$'):worker.railway_env()
  self.assertEqual(json.loads(self.file.read_text()),{'user':{'token':'fixture-concurrent-login'}})
if __name__=='__main__':unittest.main(verbosity=2)
