const admin = require('./firebase');
const firestore = admin.firestore();

class FirestoreTalker {
  constructor() { }

  static async checkPathExistInFirestore({ path, fieldNames = [] }) {
    const pathSegments = path.split('/');

    // Document reference
    if (pathSegments.length % 2 === 0) {
      const docRef = firestore.doc(path);
      try {
        const docSnapshot = await docRef.get();
        // If the document doesn't exist, return false
        if (!docSnapshot.exists) {
          return false;
        }
        // If fieldNames were provided, check that all fields exist in the document
        if (fieldNames.length > 0) {
          const data = docSnapshot.data();
          return fieldNames.every(field => field in data);
        }
        // If no fieldNames were provided, return true because the document exists
        return true;
      } catch (error) {
        console.error("Error checking document existence:", error);
        return false;
      }
    }
    // Collection reference
    else {
      const collectionRef = firestore.collection(path);
      try {
        const snapshot = await collectionRef.limit(1).get();
        return !snapshot.empty;  // returns true if the collection has at least one document, false otherwise
      } catch (error) {
        console.error("Error checking collection existence:", error);
        return false;
      }
    }
  }

  static async upsertFirestoreDocument({ documentPath, dataObject }) {
    const pathSegments = documentPath.split('/');

    // Ensure the path points to a document
    if (pathSegments.length % 2 === 0) {
      const documentRef = firestore.doc(documentPath);

      try {
        // Use set with merge option for upsert behavior
        await documentRef.set(dataObject, { merge: true });
        return true;
      } catch (error) {
        console.error("Error upserting document:", error);
        return false;
      }
    } else {
      console.error("Invalid path for upserting a document. Path should point to a document.");
      return false;
    }
  }

  static async uploadDocumentToFirestore({ collectionPath, dataObject, idValue = null }) {
    const pathSegments = collectionPath.split('/');

    if (pathSegments.length % 2 !== 0) {
      const collectionRef = firestore.collection(collectionPath);

      try {
        if (!idValue) {
          // Add a new document with a generated id.
          const docRef = await collectionRef.add(dataObject);
          return docRef.id;
        } else {
          const docRef = collectionRef.doc(idValue);
          await docRef.set(dataObject);
          return idValue;
        }
      } catch (error) {
        console.error("Error creating document:", error);
        return null;
      }
    } else {
      console.error("Invalid path for creating a document. Path should point to a collection.");
      return null;
    }
  }

  static async updateFirestoreDocument({ documentPath, changes }) {
    const pathSegments = documentPath.split('/');

    if (pathSegments.length % 2 === 0) {
      const documentRef = firestore.doc(documentPath);

      try {
        await documentRef.update(changes);
        return true;
      } catch (error) {
        console.error("Error updating document:", error);
        return false;
      }
    } else {
      console.error("Invalid path for updating a document. Path should point to a document.");
      return false;
    }
  }

  static async getFromFirestore({ path, idFieldIdentifier = "id", queries = [] }) {
    const pathSegments = path.split('/');
    const _constructDataDict = ({ dataObject, idFieldIdentifier, idValue }) => {
      if (!idFieldIdentifier) {
        idFieldIdentifier = "id";
      }
      const result = {
        [idFieldIdentifier]: idValue,
        ...dataObject
      }
      return result
    }

    if (pathSegments.length % 2 === 0) {
      const docRef = firestore.doc(path);

      try {
        const docSnapshot = await docRef.get();
        return _constructDataDict({ dataObject: docSnapshot.data(), idFieldIdentifier, idValue: docSnapshot.id });
      } catch (error) {
        console.error("Error fetching document:", error);
        return null;
      }
    } else {
      let collectionRef = firestore.collection(path);

      // Loop through the query array and add a where clause for each condition in each field.
      for (let fieldQuery of queries) {
        for (let condition of fieldQuery.query) {
          collectionRef = collectionRef.where(fieldQuery.field, condition.sign, condition.value);
        }
      }
      try {
        const querySnapshot = await collectionRef.get();
        const collectionData = querySnapshot.docs.map((doc) => {
          return _constructDataDict({ dataObject: doc.data(), idFieldIdentifier, idValue: doc.id });
        });

        return collectionData;
      } catch (error) {
        console.error("Error fetching collection:", error);
        return [];
      }
    }
  }

  static async removeFromFirestoreAtPath({ path, canBeCollection = false }) {
    const pathSegments = path.split('/');

    // If path is to a document
    if (pathSegments.length % 2 === 0) {
      try {
        await firestore.doc(path).delete();
        console.log(`Document at path ${path} successfully deleted.`);
      } catch (error) {
        console.error("Error removing document:", error);
      }
    }
    // If path is to a collection
    else if (canBeCollection) {
      const collectionRef = firestore.collection(path);
      const docsSnapshot = await collectionRef.get();
      const batch = firestore.batch();
      docsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      try {
        await batch.commit();
        console.log(`All documents in the collection at path ${path} successfully deleted.`);
      } catch (error) {
        console.error("Error removing documents in the collection:", error);
      }
    }
  }

  static async incrementToDatabase({ documentPath, fieldname, delta }) {
    const pathSegments = documentPath.split('/');

    if (pathSegments.length % 2 === 0) {
      const documentRef = firestore.doc(documentPath);

      try {
        const increment = admin.firestore.FieldValue.increment(delta);
        await documentRef.update({ [fieldname]: increment });
        return true;
      } catch (error) {
        console.error("Error updating document:", error);
        return false;
      }
    } else {
      console.error("Invalid path for updating a document. Path should point to a document.");
      return false;
    }
  }
}

module.exports = FirestoreTalker;