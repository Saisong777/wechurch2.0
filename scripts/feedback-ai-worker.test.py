import importlib.util,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('worker',Path(__file__).with_name('feedback-ai-worker.py'))
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)

class WorkerTests(unittest.TestCase):
 def test_refresh_uses_installed_node_without_credential_argv_or_environment(self):
  from types import SimpleNamespace
  with tempfile.TemporaryDirectory() as d:
   home=Path(d);folder=home/'.railway';folder.mkdir();config=folder/'config.json';config.write_text(json.dumps({'user':{'refreshToken':'fixture-refresh','accessToken':'fixture-old','tokenExpiresAt':0}}))
   with patch.object(w.Path,'home',return_value=home),patch.object(w.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=json.dumps({'access_token':'fixture-new','expires_in':3600,'refresh_token':'fixture-next'}))) as child:
    result=w.railway_env();self.assertEqual(result['RAILWAY_API_TOKEN'],'fixture-new')
    self.assertEqual(child.call_args.args[0][0],'node');self.assertNotIn('fixture-refresh',' '.join(child.call_args.args[0]));self.assertNotIn('RAILWAY_API_TOKEN',child.call_args.kwargs['env']);self.assertEqual(json.loads(child.call_args.kwargs['input']),{'refreshToken':'fixture-refresh'})
    self.assertEqual(json.loads(config.read_text())['user']['refreshToken'],'fixture-next');self.assertEqual(config.stat().st_mode&0o077,0)
 def test_refresh_does_not_overwrite_concurrently_changed_login(self):
  from types import SimpleNamespace
  with tempfile.TemporaryDirectory() as d:
   home=Path(d);folder=home/'.railway';folder.mkdir();config=folder/'config.json';config.write_text(json.dumps({'user':{'refreshToken':'fixture','tokenExpiresAt':0}}))
   def concurrent(*args,**kwargs):
    config.write_text('{"user":{"marker":"newer-login"}}');return SimpleNamespace(returncode=0,stdout='{"access_token":"fixture-new","expires_in":3600}')
   with patch.object(w.Path,'home',return_value=home),patch.object(w.subprocess,'run',side_effect=concurrent),self.assertRaises(w.SafeFailure):w.railway_env()
   self.assertEqual(json.loads(config.read_text()),{'user':{'marker':'newer-login'}})
 def test_refresh_failure_has_no_alternate_transport_or_credential_output(self):
  from types import SimpleNamespace
  with tempfile.TemporaryDirectory() as d:
   home=Path(d);folder=home/'.railway';folder.mkdir();config=folder/'config.json';raw=json.dumps({'user':{'refreshToken':'fixture-secret','tokenExpiresAt':0}});config.write_text(raw)
   with patch.object(w.Path,'home',return_value=home),patch.object(w.subprocess,'run',return_value=SimpleNamespace(returncode=1,stdout='fixture-secret',stderr='fixture-secret')) as child,self.assertRaises(w.SafeFailure) as failure:w.railway_env()
   self.assertEqual(str(failure.exception),'railway_login_refresh_failed');self.assertEqual(child.call_count,1);self.assertEqual(config.read_text(),raw)
 def test_remote_arguments_do_not_repeat_member_source(self):
  import base64
  from types import SimpleNamespace
  settings={'site':'B','railway':'fixture-cli','repositorySha256':'a'*64,'databaseHostSha256':'b'*64}
  claim={'id':'fixture','token':'fixture','contentHash':'c'*64,'sourceVersion':1,'title':'private fixture','body':'private fixture'}
  with patch.object(w,'railway_env',return_value={}),patch.object(w.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout='WECHURCH_FEEDBACK_RESULT:{"ok":true}')) as child:
   self.assertTrue(w.bridge(settings,'complete',claim=claim,analysis={},model='fixture')['ok'])
   command=child.call_args.args[0][-1];blob=command.rstrip("'").split()[-1];request=json.loads(base64.b64decode(blob));self.assertEqual(set(request['claim']),{'id','token','contentHash','sourceVersion'});self.assertNotIn('private fixture',json.dumps(request))
 def test_no_credential_environment_forwarded(self):
  with patch.dict(os.environ,{'OPENAI_API_KEY':'fixture','SECRET_PASSWORD':'fixture','RAILWAY_API_TOKEN':'fixture','DATABASE_URL':'fixture'}):
   self.assertTrue(set(w.child_env())<=set(('HOME','PATH','TMPDIR','TMP','TEMP','LANG','LC_ALL','CODEX_HOME')))
 def test_idle_never_calls_model(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'config.json';p.write_text(json.dumps({'site':'B','enabled':True,'subscriptionOnly':True,'repositorySha256':'a'*64,'databaseHostSha256':'b'*64}))
   with patch.object(w,'bridge',return_value={'claims':[]}),patch.object(w,'analyze') as model:
    self.assertEqual(w.run(p)['status'],'idle');model.assert_not_called()
 def test_no_paid_fallback_or_unverified_site(self):
  for changes in ({'subscriptionOnly':False},{'site':'X'},{'enabled':False}):
   with tempfile.TemporaryDirectory() as d:
    p=Path(d)/'config.json';p.write_text(json.dumps({'site':'B','enabled':True,'subscriptionOnly':True,**changes}))
    with patch.object(w,'bridge') as remote,self.assertRaises(w.SafeFailure):w.run(p)
    remote.assert_not_called()
 def test_unknown_commit_is_not_repeated_or_marked_failed(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'config.json';p.write_text(json.dumps({'site':'B','enabled':True,'subscriptionOnly':True,'repositorySha256':'a'*64,'databaseHostSha256':'b'*64}))
   with patch.object(w,'bridge',side_effect=[{'claims':[{'id':'fixture'}]},w.SafeFailure('remote_operation_unconfirmed')]) as remote,patch.object(w,'analyze',return_value=({},'fixture')) as model:
    with self.assertRaises(w.SafeFailure):w.run(p)
    self.assertEqual(remote.call_count,2);self.assertEqual(model.call_count,1)
 def test_model_failure_releases_only_its_lease(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'config.json';p.write_text(json.dumps({'site':'B','enabled':True,'subscriptionOnly':True,'repositorySha256':'a'*64,'databaseHostSha256':'b'*64}))
   claim={'id':'fixture','token':'fixture'}
   with patch.object(w,'bridge',side_effect=[{'claims':[claim]},{'ok':True}]) as remote,patch.object(w,'analyze',side_effect=w.SafeFailure('model_unavailable')):
    with self.assertRaises(w.SafeFailure):w.run(p)
    self.assertEqual(remote.call_args.args[1],'fail');self.assertEqual(remote.call_args.kwargs,{'claim':claim})

if __name__=='__main__':unittest.main()
