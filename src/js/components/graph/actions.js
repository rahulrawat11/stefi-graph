import Log from "~/services/log";
import Neo4jService from "~/services/neo4j/neo4j";
import {pushNotification}from "~/components/notifications/actions";

/**
* Module logger.
*/
const log = new Log('Actions.graph');

/**
* Save the current hover node into state.
*/
export function setOverObject(tree, object) {
  runLayout(tree, false);
  tree.select('data', 'over').set(object);
  tree.commit();
}

/**
* Save the current right click node into state.
*/
export function setRightClick(tree, type, object, captor) {
  runLayout(tree, false);
  tree.select('data', 'rightClick').set({
      type:type,
      object: object,
      x:(captor?captor.clientX:null),
      y:(captor?captor.clientY:null)
    });
}

/**
* Save the current click object into state.
*/
export function setClickObject(tree, object) {
  runLayout(tree, false);
  var cursor = tree.select('data', 'selected');
  var selected = cursor.get();
  // If selected already contains node => remove it
  // Otherwise adding it
  if(selected.some((e) => { return (e.id == object.id)})) {
    tree.select('data', 'selected').set(selected.filter((e) => { return (e.id != object.id)}));
  } else {
    cursor.push(object);
  }
  tree.commit();
}

/**
* Toggle label visibility
*/
export function toggleLabelVisibility(tree, label) {
  runLayout(tree, false);
  tree.select('settings','style', 'labels', label).set('hidden', !tree.select('settings','style', 'labels', label, 'hidden').get())
}

/**
* Toggle edge type visibility
*/
export function toggleEdgeVisibility(tree, type) {
  runLayout(tree, false);
  tree.select('settings','style', 'edges', type).set('hidden', !tree.select('settings','style', 'edges', type, 'hidden').get())
}

/**
* Save/update label style
*/
export function saveLabelStyle(tree, label, style) {
  runLayout(tree, false);
  var cleanStyle = style;
  if(!style.image.url){
    cleanStyle.image = {};
  }
  if(!style.icon.name){
    cleanStyle.icon = {};
  }
  tree.select('settings','style', 'labels', label).set(style);
}

/**
* Save/update edge style
*/
export function saveEdgeStyle(tree, edge, style) {
  runLayout(tree, false);
  tree.select('settings','style', 'edges', edge).set(style);
}

/**
 * Enable the graph layout
 */
export function runLayout(tree, run){
  tree.select('data', 'runLayout').set(run);
}

/**
 * Node : edit
 */
export function nodeEdit(tree, nodeId){
  tree.select('data', 'edit').set({type:'node', id:nodeId});
}

/**
 * Node : hide
 */
export function nodeHide(tree, nodeId){
  setRightClick(tree, null, null, null) ;
  // remove node from graph
  tree.select('data', 'graph', 'nodes').unset(nodeId);
  // remove node's edges from graph
  var newEdges ={};
  let edges = tree.get('data', 'graph', 'edges');
  Object.keys(edges).forEach(
    item =>  {
      if(edges[item].source !== nodeId && edges[item].target !== nodeId ) {
        newEdges[item] = edges[item];
      }
    }
  )
  tree.select('data', 'graph', 'edges').set(newEdges);
}

/**
 * Edge : hide
 */
export function edgeHide(tree, edgeId){
  setRightClick(tree, null, null, null) ;
  // remove edges from graph
  var newEdges ={};
  let edges = tree.get('data', 'graph', 'edges');
  Object.keys(edges).forEach(
    item =>  {
      if(edges[item].id !== edgeId) {
        newEdges[item] = edges[item];
      }
    }
  )
  tree.select('data', 'graph', 'edges').set(newEdges);
}

/**
 * Node : delete
 */
export function nodeDelete(tree, nodeId){
  setRightClick(tree, null, null, null) ;

  const configNeo4j = tree.select('settings', 'neo4j').get();
  const neo4j = new Neo4jService(configNeo4j.url, configNeo4j.login, configNeo4j.password);

  neo4j.cypher('MATCH (n) WHERE id(n)={id} WITH n DETACH DELETE n', {id:nodeId}).then(
    result => {
      pushNotification(tree, {
        title: "Success: ",
        message: "Deleting node \"" + nodeId + "\"",
        type: "success"
      });
      nodeHide(tree, nodeId);
    },
    reason => {
      pushNotification(tree, {
        title: "Error: ",
        message: JSON.stringify(reason),
        type : "danger"
      });
    }
  )
}

/**
 * Edge : delete
 */
export function edgeDelete(tree, edgeId){
  setRightClick(tree, null, null, null) ;

  const configNeo4j = tree.select('settings', 'neo4j').get();
  const neo4j = new Neo4jService(configNeo4j.url, configNeo4j.login, configNeo4j.password);

  neo4j.cypher('MATCH ()-[r]->() WHERE id(r)={id} DELETE r', {id:edgeId}).then(
    result => {
      pushNotification(tree, {
        title: "Success: ",
        message: "Deleting edge \"" + edgeId + "\"",
        type: "success"
      });
      edgeHide(tree, nodeId);
    },
    reason => {
      pushNotification(tree, {
        title: "Error: ",
        message: JSON.stringify(reason),
        type : "danger"
      });
    }
  )
}

// TODO: update node in state if already here
export function nodeSave(tree, id, props){
  const configNeo4j = tree.select('settings', 'neo4j').get();
  const neo4j = new Neo4jService(configNeo4j.url, configNeo4j.login, configNeo4j.password);
  neo4j.cypher("MATCH (o) WHERE id(o)={id} WITH o SET o={props} RETURN o", {id:id, props:props}).then(
    result => {
      pushNotification(tree, {
        title: "Success: ",
        message: "Node \"" + id + "\" is saved",
        type: "success"
      });
    },
    reason => {
      pushNotification(tree, {
        title: "Error: ",
        message: JSON.stringify(reason),
        type : "danger"
      });
    }
  );
}

/**
 * Node : expand.
 */
export function nodeExpand(tree, nodeId, type, direction){
  setRightClick(tree, null, null, null) ;

  const configNeo4j = tree.select('settings', 'neo4j').get();
  const neo4j = new Neo4jService(configNeo4j.url, configNeo4j.login, configNeo4j.password);

  var query = "";
  switch (direction) {
    case 'incoming':
      query = "MATCH (n)<-[r]-(m) "
      break;
    case 'outgoing':
      query = "MATCH (n)-[r]->(m) "
      break;
    default:
      query = "MATCH (n)-[r]-(m) "
      break;
  }
  query += 'WHERE id(n)={id} ';
  if(type)
    query += ' AND type(r) ={type} ';
query += 'RETURN n,m';
  // on success we merge the result with graph state
  neo4j.graph(query, {id:nodeId, type:type}).then(
    result => {
      let graph = tree.get('data', 'graph');
      runLayout(tree, true);
      tree.select('data', 'graph', 'nodes').set(Object.assign({}, graph.nodes, result.nodes));
      tree.select('data', 'graph', 'edges').set(Object.assign({}, graph.edges, result.edges));
    },
    reason => {
      pushNotification(tree, {
        title: "Error: ",
        message: JSON.stringify(reason),
        type : "danger"
      });
    });
}

export function nodeCollapse(tree, selection){
  //TODO : remove all child node that doesn't have a relationship
}

export function selectionReset(tree){
  tree.set(['data', 'selected'], []);
}

export function selectionKeep(tree, selection){
  selectionReset(tree);
  let newGraph = {nodes:{}, edges:[]};
  let graph = tree.get('data', 'graph');

  var selectedNodeId = selection
    .filter(item => { return item.hasOwnProperty('labels') })
    .map( item => { return item.id });

  var selectedEdgeId = selection
    .filter(item => { return !item.hasOwnProperty('labels') })
    .map( item => { return item.id });

  // keep only selected node
  selectedNodeId.forEach( item => {
    newGraph.nodes[item] = graph.nodes[item];
  })

  // if there is some selected edges : => keep only those
  if(selectedEdgeId.length > 0){
    selectedEdgeId.forEach( item => {
      newGraph.edges[item] = graph.edges[item];
    })
  }
  // otherwise we keep all edges that relate selected node
  else {
    Object.keys(graph.edges).forEach( item => {
      var edge = graph.edges[item];
      if ( (selectedNodeId.indexOf(edge.source) > -1) && (selectedNodeId.indexOf(edge.target) > -1)) {
        newGraph.edges[edge.id] = edge;
      }
    });
  }
  tree.select('data', 'graph').set(newGraph);
}

export function selectionHide(tree, selection){
  // hide nodes
  selection
    .filter(item => { return item.hasOwnProperty('labels') })
    .forEach( item => {
      nodeHide(tree, item.id);
    });
  // hide edges
  selection
    .filter(item => { return !item.hasOwnProperty('labels') })
    .forEach( item => {
      edgeHide(tree, item.id);
    });
  selectionReset(tree);
}

export function selectionDelete(tree, selection){
  // hide nodes
  selection
    .filter(item => { return item.hasOwnProperty('labels') })
    .forEach( item => {
      nodeDelete(tree, item.id);
    });
  // hide edges
  selection
    .filter(item => { return !item.hasOwnProperty('labels') })
    .forEach( item => {
      edgeDelete(tree, item.id);
    });
  selectionReset(tree);
}
